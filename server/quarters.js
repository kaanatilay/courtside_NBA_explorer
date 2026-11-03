// Derived team counts are kept separate from ESPN's published period points.
// A failed metric is withheld for the whole game, preserving honest averages.
const countingKeys = ['ast', 'oreb', 'dreb', 'blk', 'stl', 'ftm', 'fta', 'tpm', 'tpa', 'leadChanges'];
const allKeys = ['pts', ...countingKeys];
const emptyCounts = () => Object.fromEntries(allKeys.map(key => [key, 0]));
const finiteCount = value => Number.isInteger(value) && value >= 0;

// ESPN supplies both M:SS and decimal-second clocks near the end of periods.
function clockSeconds(value) {
  if (typeof value !== 'string') return null;
  if (/^\d+:\d{2}(?:\.\d+)?$/.test(value)) {
    const [minutes, seconds] = value.split(':').map(Number);
    return seconds < 60 ? minutes * 60 + seconds : null;
  }
  return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
}

// Compare only fields that affect counting, order or attribution. Identical
// repeated IDs are safe to deduplicate; conflicting versions require review.
function eventSignature(play) {
  return JSON.stringify([play.sequenceNumber, play.period?.number, play.clock?.displayValue,
    play.type?.text, play.text, play.team?.id, play.participants?.map(item => item.athlete?.id),
    play.scoringPlay, play.scoreValue, play.shootingPlay, play.pointsAttempted, play.homeScore, play.awayScore]);
}

export function deriveTeamQuarters(payload, sides, teamMap) {
  const ids = teamMap.map(team => team.id);
  const periods = Math.max(...ids.map(id => sides[id].periods.length));
  const counts = Object.fromEntries(ids.map(id => [id, Array.from({ length: periods }, emptyCounts)]));
  const issues = Object.fromEntries(ids.map(id => [id, {}]));
  const actorTeams = new Map();
  for (const id of ids) for (const player of sides[id].players) actorTeams.set(player.id, id);
  const teamIds = new Map(teamMap.map(team => [team.providerId, team.id]));
  let eventCount = 0, duplicates = 0, reviews = 0, lateEvents = 0;

  // Reasons are suitable for display beneath the included-game table.
  function flag(id, key, reason) { issues[id][key] ||= reason; }
  function flagAll(reason) { for (const id of ids) for (const key of countingKeys) flag(id, key, reason); }
  function result() {
    return Object.fromEntries(ids.map(id => {
      const available = countingKeys.filter(key => !issues[id][key]);
      return [id, {
        periods: sides[id].periods.map((period, index) => ({ pts: period.pts,
          ...Object.fromEntries(countingKeys.map(key => [key, issues[id][key] ? null : counts[id][index][key]])),
        })),
        quarterValidation: { method: 'calculated-from-play-by-play',
          status: available.length === countingKeys.length ? 'checked' : available.length ? 'partial' : 'unavailable',
          unavailable: issues[id], eventCount, duplicatesRemoved: duplicates, reviewEvents: reviews, lateEvents },
      }];
    }));
  }

  if (periods < 4 || ids.some(id => sides[id].periods.length !== periods)) {
    flagAll('The period score breakdown is incomplete or inconsistent.'); return result();
  }
  if (!Array.isArray(payload.plays) || !payload.plays.length) {
    flagAll('ESPN did not supply play-by-play for this game.'); return result();
  }

  const seen = new Map();
  const plays = [];
  for (const play of payload.plays) {
    if (!play || typeof play.id !== 'string' || !play.id || !/^\d+$/.test(String(play.sequenceNumber))
      || !Number.isSafeInteger(Number(play.sequenceNumber)) || Number(play.sequenceNumber) <= 0) {
      flagAll('A recorded play is missing its identifier or sequence.'); return result();
    }
    if (play.participants != null && (!Array.isArray(play.participants) || play.participants.some(item => !item?.athlete?.id))) {
      flagAll('A recorded play has an unreadable participant list.'); return result();
    }
    const signature = eventSignature(play);
    if (seen.has(play.id)) {
      if (seen.get(play.id) !== signature) {
        flagAll('The feed contains conflicting versions of the same play.'); return result();
      }
      duplicates++; continue;
    }
    seen.set(play.id, signature); plays.push(play);
  }
  plays.sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
  const sequences = new Set();
  const finished = new Set();
  let lastPeriod = 1, lastClock = 720;

  for (const play of plays) {
    const period = play.period?.number;
    const clock = clockSeconds(play.clock?.displayValue);
    const type = String(play.type?.text || '').trim().toLowerCase();
    const text = String(play.text || '');
    if (!Number.isInteger(period) || period < 1 || period > periods || clock == null || clock < 0 || clock > (period <= 4 ? 720 : 300)) {
      flagAll('A recorded play has an invalid period or game clock.'); return result();
    }
    if (sequences.has(Number(play.sequenceNumber))) {
      flagAll('Different plays share the same sequence number.'); return result();
    }
    sequences.add(Number(play.sequenceNumber));
    // Final feeds can insert corrected plays late, even after the next quarter
    // starts. Counts use the event's explicit period, not arrival/sequence order.
    // Still validate clock bounds above and reconcile each period's points below.
    if (period < lastPeriod || (period === lastPeriod && clock > lastClock)) lateEvents++;
    lastPeriod = period; lastClock = clock;
    if ((type === 'end period' || type === 'end game') && clock === 0) finished.add(period);
    if (/review|overturn|challenge/i.test(text)) reviews++;
    eventCount++;

    const id = teamIds.get(String(play.team?.id));
    const opponent = ids.find(other => other !== id);
    const participants = (play.participants || []).map(item => String(item.athlete?.id));
    const primaryMatches = id && actorTeams.get(participants[0]) === id;
    const assisted = /\([^()]+ assists\)/i.test(text);
    const blocked = /\bblocks\b/i.test(text);
    const rebound = type === 'offensive rebound' ? 'oreb' : type === 'defensive rebound' ? 'dreb' : null;

    // Points also act as an integrity check against every published line score.
    // Technical free throws count as points; a missed free throw does not.
    if (play.scoringPlay) {
      if (!primaryMatches || ![1, 2, 3].includes(play.scoreValue)) {
        flagAll('A scoring play could not be attributed reliably.'); return result();
      }
      counts[id][period - 1].pts += play.scoreValue;
      if (assisted) {
        if (play.scoreValue < 2 || participants[1] === participants[0] || actorTeams.get(participants[1]) !== id) {
          flag(id, 'ast', 'An assist has ambiguous player/team attribution.');
        } else counts[id][period - 1].ast++;
      }
    }

    // ESPN box-score OREB/DREB here represent credited player rebounds. Team
    // and dead-ball rebounds are separate events and must not inflate them.
    if (rebound && !/\bteam rebound\b/i.test(text)) {
      if (!primaryMatches) {
        if (id) flag(id, rebound, 'A rebound has ambiguous player/team attribution.');
        else for (const team of ids) flag(team, rebound, 'A rebound has no recognized team.');
      } else counts[id][period - 1][rebound]++;
    }

    // A block appears on the SHOOTER's missed-shot event. The second listed
    // participant must belong to the opposing team before credit is assigned.
    if (blocked) {
      if (!primaryMatches || play.scoringPlay || actorTeams.get(participants[1]) !== opponent) {
        for (const team of ids) flag(team, 'blk', 'A block has ambiguous shooter/defender attribution.');
      } else counts[opponent][period - 1].blk++;
    }

    // Like blocks, a steal is attached to the offensive player's turnover.
    // Require both participant roles; never credit the offensive event team.
    if (/\bsteals\b/i.test(text)) {
      if (!primaryMatches || !/turnover/.test(type) || actorTeams.get(participants[1]) !== opponent || play.scoringPlay) {
        for (const team of ids) flag(team, 'stl', 'A steal has ambiguous turnover/defender attribution.');
      } else counts[opponent][period - 1].stl++;
    }

    // Count actual FT/three-point attempts, including misses and technical FTs.
    // Ambiguous descriptions or results withhold the affected shooting pair.
    const freeThrow = /free throw/.test(type);
    // Full responses have pointsAttempted even when the description omits
    // distance/'three'. Older compact fixtures may not; do not infer from shot
    // type, distance or the aggregate total which missed shot was a three.
    const threeDescription = /\bthree[ -]+point(?:er)?\b/i.test(text);
    const threePointer = play.pointsAttempted === 3 || threeDescription || play.scoringPlay && play.scoreValue === 3;
    const ftDescription = /\b(?:makes|misses)\b.*\bfree throw\b/i.test(text);
    const shotOutcome = /\bmakes\b/i.test(text) ? 'made' : /\bmisses\b/i.test(text) || blocked ? 'missed' : null;
    const shot = (madeKey, attemptKey, value, recognized) => {
      const valid = recognized && primaryMatches && shotOutcome &&
        (shotOutcome === 'made' ? play.scoringPlay === true && play.scoreValue === value : !play.scoringPlay && play.scoreValue === 0);
      if (!valid) {
        for (const team of id ? [id] : ids) for (const key of [madeKey, attemptKey]) flag(team, key, 'A shooting attempt has ambiguous shooter/type/result attribution.');
      } else {
        counts[id][period - 1][attemptKey]++;
        if (shotOutcome === 'made') counts[id][period - 1][madeKey]++;
      }
    };
    if (freeThrow || ftDescription) shot('ftm', 'fta', 1, freeThrow);
    if (threePointer) shot('tpm', 'tpa', 3, !freeThrow && play.shootingPlay === true && (play.pointsAttempted == null || play.pointsAttempted === 3));
  }

  // Lead changes need chronological scoring, not feed-arrival order. Retain
  // the last non-tied leader across ties and periods; the first lead isn't a
  // change. Check every scoring snapshot so late corrections cannot silently
  // assign a lead change to the wrong point in time. Credit the game count to
  // both team rows (it is not a team-specific achievement).
  const home = ids.find(id => sides[id].homeAway === 'home');
  const away = ids.find(id => sides[id].homeAway === 'away');
  if (!home || !away || home === away) {
    for (const id of ids) flag(id, 'leadChanges', 'Home/away identities are missing for score chronology.');
  } else {
    const scores = Object.fromEntries(ids.map(id => [id, 0]));
    let leader = null;
    const chronological = [...plays].sort((a, b) => a.period.number - b.period.number ||
      clockSeconds(b.clock.displayValue) - clockSeconds(a.clock.displayValue) || Number(a.sequenceNumber) - Number(b.sequenceNumber));
    for (const play of chronological.filter(p => p.scoringPlay)) {
      const id = teamIds.get(String(play.team?.id));
      scores[id] += play.scoreValue;
      if (!finiteCount(play.homeScore) || !finiteCount(play.awayScore) || scores[home] !== play.homeScore || scores[away] !== play.awayScore) {
        for (const team of ids) flag(team, 'leadChanges', 'Chronological scoring does not match recorded score snapshots; lead changes cannot be verified.');
      }
      const next = scores[home] > scores[away] ? home : scores[away] > scores[home] ? away : null;
      if (next) {
        if (leader && next !== leader) for (const team of ids) counts[team][play.period.number - 1].leadChanges++;
        leader = next;
      }
    }
  }

  if (finished.size !== periods) flagAll('The play-by-play is missing one or more period endings.');
  // Include overtime in reconciliation, but never fold it into Q4.
  const pointsMatch = ids.every(id => counts[id].every((row, index) => row.pts === sides[id].periods[index].pts));
  if (!pointsMatch) flagAll('Recorded scoring plays do not match the published period scores.');
  for (const id of ids) for (const key of countingKeys) {
    const total = counts[id].reduce((sum, period) => sum + period[key], 0);
    const expected = sides[id].stats[key];
    if (!finiteCount(expected)) flag(id, key, 'The full-game box-score value is unavailable.');
    else if (total !== expected) flag(id, key, `Recorded plays total ${total}; the full-game box score reports ${expected}.`);
  }
  return result();
}
