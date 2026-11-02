import { writeFile } from 'node:fs/promises';
import { normalizeGame } from '../server/normalize.js';

// Research only: sample all six divisions across three seasons. No app/database
// writes. Requests use two workers, fixed timeouts and no automatic retries.
const base = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
let teams = [{ id: '2', name: 'BOS' }, { id: '4', name: 'CHI' },
  { id: '1', name: 'ATL' }, { id: '7', name: 'DEN' },
  { id: '13', name: 'LAL' }, { id: '24', name: 'SA' }];
const asOf = '2026-11-03T00:00:00Z';
async function request(url) {
  const start = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { url, ms: Math.round(performance.now() - start), payload: await response.json() };
  } catch (error) { return { url, ms: Math.round(performance.now() - start), error: error.message, cause: error.cause?.code }; }
}
async function mapBounded(items, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all([0, 1].map(async () => { while (cursor < items.length) { const i = cursor++; results[i] = await fn(items[i]); } }));
  return results;
}
// League inventory avoids expanding the application's four-team UI catalog.
const inventory = await request(`${base}/teams?limit=100`);
if (inventory.error) throw new Error(`Team inventory failed: ${inventory.error}`);
teams = inventory.payload.sports[0].leagues[0].teams.map(({ team }) => ({ id: team.id, name: team.abbreviation }));
if (teams.length !== 30) throw new Error(`Expected 30 team identities, received ${teams.length}`);
const schedules = teams.flatMap(team => [2025, 2026, 2027].flatMap(season => [2, 3].map(type => ({ team, season, type }))));
const scheduleResults = await mapBounded(schedules, async ({ team, season, type }) => {
  const r = await request(`${base}/teams/${team.id}/schedule?season=${season}&seasontype=${type}`);
  if (r.error) return { team, season, type, ...r };
  const events = r.payload.events || [];
  const completed = events.filter(e => e.competitions?.[0]?.status?.type?.completed && Date.parse(e.date) < Date.parse(asOf));
  const unique = [...new Set(events.map(e => e.id))];
  return { team, season, type, url: r.url, ms: r.ms, responseSeason: r.payload.season, returned: events.length,
    unique: unique.length, completed: completed.length,
    earliest: events.map(e => e.date).sort()[0], latest: events.map(e => e.date).sort().at(-1),
    events: events.map(e => ({ id: e.id, date: e.date, name: e.name, season: e.season, seasonType: e.seasonType,
      completed: e.competitions?.[0]?.status?.type?.completed, notes: e.competitions?.[0]?.notes })),
    sample: completed.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]?.id };
});
// Keep detailed game sampling bounded to six division representatives, including
// playoff examples; schedule inventory is broader than box-score validation.
const representatives = new Set(['2','4','1','7','13','24']);
const ids = [...new Set(scheduleResults.filter(r => representatives.has(r.team.id)).map(r => r.sample).filter(Boolean))];
const games = await mapBounded(ids, async id => {
  const r = await request(`${base}/summary?event=${id}`);
  if (r.error) return { id, ...r };
  try {
    const game = normalizeGame(r.payload);
    return { id, url: r.url, ms: r.ms, date: game.date,
      teams: Object.entries(game.sides).map(([team, s]) => ({ team, players: s.players.length,
        played: s.players.filter(p => p.played).length,
        missingPlayerMetrics: s.players.filter(p => p.played).flatMap(p => Object.entries(p.stats).filter(([, v]) => v == null).map(([key]) => `${p.id}:${key}`)),
        periodCount: s.periods.length, quarterValidation: s.quarterValidation,
        missingTeamMetrics: Object.entries(s.stats).filter(([, v]) => v == null).map(([key]) => key) })) };
  } catch (error) { return { id, url: r.url, ms: r.ms, error: error.message }; }
});
const report = { checkedAt: new Date().toISOString(), asOfExclusiveUTC: asOf,
  scope: 'All 30 teams, three seasons, regular season and postseason schedule requests; game samples from six division representatives, not exhaustive box-score coverage.',
  schedules: scheduleResults, games };
await writeFile(new URL('./coverage-audit-results.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ schedules: scheduleResults.map(({ team, season, returned, completed, error, cause }) => ({ team: team.name, season, returned, completed, error, cause })), games }, null, 2));
