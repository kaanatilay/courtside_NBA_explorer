import { writeFile } from 'node:fs/promises';

// Research only: test a deliberately simple event parser against published
// full-game totals. Matching a few games does NOT validate all historical
// games, corrections, stat definitions or per-player minute reconstruction.
const ids = ['401909285', '401704627', '401909880'];
const results = [];
for (const id of ids) {
  const source = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`;
  const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`ESPN ${response.status} for ${id}`);
  const payload = await response.json();
  const competitors = payload.header.competitions[0].competitors;
  const sides = Object.fromEntries(competitors.map(team => [team.team.id, { name: team.team.abbreviation, periods: {} }]));
  let unassigned = 0;
  for (const play of payload.plays || []) {
    const teamId = String(play.team?.id);
    const period = play.period?.number;
    const text = play.text || '';
    if (!sides[teamId] || !period) { unassigned++; continue; }
    const row = sides[teamId].periods[period] ||= { pts: 0, ast: 0, oreb: 0, dreb: 0, blk: 0 };
    if (play.scoringPlay) row.pts += Number(play.scoreValue) || 0;
    if (play.scoringPlay && /\bassists\)/i.test(text)) row.ast++;
    // Excluding team/dead-ball rebounds is an explicit experimental assumption.
    if (play.participants?.length && play.type?.text === 'Offensive Rebound') row.oreb++;
    if (play.participants?.length && play.type?.text === 'Defensive Rebound') row.dreb++;
    if (/\bblocks\b/i.test(text)) {
      // This feed describes a block on the shooter's event. Credit the other
      // team for this trial only; production would verify participant roles.
      const opponent = competitors.find(team => String(team.team.id) !== teamId).team.id;
      const defensive = sides[opponent].periods[period] ||= { pts: 0, ast: 0, oreb: 0, dreb: 0, blk: 0 };
      defensive.blk++;
    }
  }
  const comparisons = competitors.map(team => {
    const box = payload.boxscore.teams.find(box => String(box.team.id) === String(team.team.id));
    const stat = name => Number(box.statistics.find(stat => stat.name === name)?.displayValue);
    const expected = { pts: Number(team.score), ast: stat('assists'), oreb: stat('offensiveRebounds'), dreb: stat('defensiveRebounds'), blk: stat('blocks') };
    const parsed = sides[team.team.id];
    const totals = Object.fromEntries(Object.keys(expected).map(key => [key, Object.values(parsed.periods).reduce((sum, row) => sum + row[key], 0)]));
    const differences = Object.fromEntries(Object.keys(expected).map(key => [key, totals[key] - expected[key]]));
    const pointPeriodsMatch = (team.linescores || []).every((line, index) => parsed.periods[index + 1]?.pts === Number(line.displayValue));
    return { team: parsed.name, expected, parsedTotals: totals, differences, pointPeriodsMatch, experimentalPeriods: parsed.periods };
  });
  results.push({ id, source, dateUTC: payload.header.competitions[0].date, plays: payload.plays?.length || 0, unassigned, comparisons });
}
const report = { checkedAt: new Date().toISOString(), warning: 'Exploratory team counts only. Full-game agreement cannot prove that every event belongs to the correct quarter. No player minutes or app integration.', results };
await writeFile(new URL('./quarter-feasibility.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(results.map(game => ({ id: game.id, plays: game.plays, teams: game.comparisons.map(team => ({ team: team.team, differences: team.differences, quarterPointsMatch: team.pointPeriodsMatch })) })), null, 2));
