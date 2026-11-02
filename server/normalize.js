import { deriveTeamQuarters } from './quarters.js';

// Unknown or absent values remain null: unavailable must never mean zero.
export function numeric(value) {
  if (value == null || String(value).trim() === '' || value === '--') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Some box scores supply rounded minutes; others supply M:SS.
export function minutes(value) {
  if (typeof value === 'string' && /^\d+:\d{2}$/.test(value)) {
    const [min, seconds] = value.split(':').map(Number);
    return seconds < 60 ? min + seconds / 60 : null;
  }
  return numeric(value);
}

const abbreviations = { GS: 'GSW', NY: 'NYK', NO: 'NOP', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
const canonicalId = value => abbreviations[value] || value;
const statKeys = { pts: 'PTS', ast: 'AST', oreb: 'OREB', dreb: 'DREB', blk: 'BLK', min: 'MIN' };

// Use event metadata: ESPN's top-level season can describe today's season even
// for historical requests. Cup championship games are outside regular totals.
export function eventClassification(event) {
  const seasonYear = Number(event.season?.year) || null;
  const seasonType = Number(event.seasonType?.type ?? event.seasonType?.id) || null;
  const notes = (event.competitions?.[0]?.notes || event.notes || []).map(note => note.headline || '').join(' ');
  const cupFinal = /\b(?:NBA|Emirates|In[- ]Season)\s+(?:NBA\s+)?(?:Cup|Tournament)?\s*(?:Championship|Final)\b/i.test(notes);
  return { seasonYear, seasonType, competitionClass: cupFinal ? 'cup-final' : seasonType === 2 ? 'regular-season' : seasonType === 3 ? 'postseason' : 'unknown' };
}

// Only final games with two known IDs qualify. An explicit scope requires
// classification evidence; missing metadata must not masquerade as an empty season.
export function normalizeSchedule(payload, now = Date.now(), scope = null) {
  if (!Array.isArray(payload.events)) throw new Error('ESPN returned an invalid schedule.');
  return [...new Map(payload.events.filter(event => {
    const competition = event.competitions?.[0];
    if (competition?.status?.type?.completed !== true || competition.competitors?.length !== 2 || Date.parse(event.date) > now || !Number.isFinite(Date.parse(event.date))) return false;
    const classification = eventClassification(event);
    if (scope && (!classification.seasonYear || !classification.seasonType)) throw new Error('ESPN event is missing season/competition metadata. Cannot verify this schedule.');
    return !scope || (classification.seasonYear === scope.season && classification.seasonType === scope.type
      && classification.competitionClass !== 'cup-final');
  }).map(event => [String(event.id), {
    id: String(event.id), dateUTC: event.date,
    ...eventClassification(event),
    teamIds: event.competitions[0].competitors.map(team => String(team.team.id)),
  }])).values()].sort((a, b) => Date.parse(b.dateUTC) - Date.parse(a.dateUTC));
}

// Full-game totals stay independent from period points: games may include OT,
// and period counts are derived and checked separately from published totals.
export function normalizeGame(payload) {
  const competition = payload.header?.competitions?.[0];
  if (!competition?.status?.type?.completed || competition.competitors?.length !== 2) throw new Error('A requested game is not final or has invalid teams.');
  if (!Array.isArray(payload.boxscore?.teams) || !Array.isArray(payload.boxscore?.players)) throw new Error('ESPN has not supplied a complete box score.');
  const sides = {};
  for (const competitor of competition.competitors) {
    const box = payload.boxscore.teams.find(team => String(team.team.id) === String(competitor.team.id));
    const roster = payload.boxscore.players.find(team => String(team.team.id) === String(competitor.team.id));
    if (!box?.statistics || !roster?.statistics?.length) throw new Error('A team box score is missing.');
    const stat = key => numeric(box.statistics.find(stat => stat.name === key)?.displayValue);
    const stats = { pts: numeric(competitor.score), ast: stat('assists'), oreb: stat('offensiveRebounds'), dreb: stat('defensiveRebounds'), blk: stat('blocks') };
    const periods = (competitor.linescores || []).map(line => ({ pts: numeric(line.displayValue ?? line.value) }));
    // Incomplete period breakdowns are unavailable rather than shown as valid.
    const reconciled = periods.length >= 4 && periods.every(period => period.pts != null)
      && periods.reduce((sum, period) => sum + period.pts, 0) === stats.pts;
    const players = roster.statistics.flatMap(group => (group.athletes || []).map(player => {
      const playerStats = Object.fromEntries(Object.entries(statKeys).map(([key, label]) => {
        const index = group.labels?.indexOf(label) ?? -1;
        const value = index < 0 ? null : player.stats?.[index];
        return [key, key === 'min' ? minutes(value) : numeric(value)];
      }));
      // Zero displayed minutes can be a short appearance rounded down. A DNP
      // flag, however, always excludes that player from appearance averages.
      const played = player.didNotPlay !== true && playerStats.min != null;
      return { id: String(player.athlete.id), name: player.athlete.displayName, played, stats: playerStats };
    }));
    sides[canonicalId(competitor.team.abbreviation)] = { stats, periods: reconciled ? periods : [], players, homeAway: competitor.homeAway };
  }
  const dateUTC = competition.date;
  if (!Number.isFinite(Date.parse(dateUTC))) throw new Error('ESPN supplied an invalid game date.');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateUTC));
  const id = String(payload.header.id);
  const derived = deriveTeamQuarters(payload, sides, competition.competitors.map(team => ({
    providerId: String(team.team.id), id: canonicalId(team.team.abbreviation),
  })));
  for (const teamId of Object.keys(sides)) Object.assign(sides[teamId], derived[teamId]);
  return { id, date, dateUTC, sides, source: `https://www.espn.com/nba/boxscore/_/gameId/${id}` };
}
