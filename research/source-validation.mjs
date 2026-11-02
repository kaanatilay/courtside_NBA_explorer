import { readFile, writeFile } from 'node:fs/promises';

// Research only: bounded public requests, with no app/cache changes or credentials.
// Failed requests remain explicit evidence; they never fall back to saved data.
const base = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const games = ['401704627', '401909285', '401703371'];
async function inspect(label, url, summarize) {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
    const body = await response.text();
    const result = { label, url, status: response.status, elapsedMs: Date.now() - started };
    if (!response.ok) return { ...result, error: body.slice(0, 180) };
    try { return { ...result, data: summarize(JSON.parse(body)) }; }
    catch (error) { return { ...result, error: `Invalid/unexpected JSON: ${error.message}` }; }
  } catch (error) {
    return { label, url, elapsedMs: Date.now() - started, error: error.message, cause: error.cause?.code };
  }
}

// Preserve labels, player IDs and period points so the evidence can be audited.
function summarizeESPN(p) {
  const c = p.header.competitions[0];
  return {
    id: p.header.id, date: c.date, completed: c.status.type.completed,
    teams: c.competitors.map(t => {
      const periods = t.linescores.map(s => Number(s.displayValue ?? s.value));
      return { team: t.team.abbreviation, score: Number(t.score), periods,
        periodPointsMatch: periods.reduce((a, b) => a + b, 0) === Number(t.score) };
    }),
    teamFields: p.boxscore.teams[0].statistics.map(s => s.name),
    players: p.boxscore.players.map(t => ({ team: t.team.abbreviation,
      groups: t.statistics.map(g => ({ labels: g.labels,
        sample: g.athletes.slice(0, 2).map(a => ({ id: a.athlete.id, name: a.athlete.displayName, values: a.stats })) })) })),
    playCount: p.plays?.length ?? 0,
    playFields: Object.keys(p.plays?.find(p => p.participants?.length) ?? {}),
    playerQuarterBoxScoreObserved: p.boxscore.players.some(t => t.statistics.some(g => g.athletes.some(a => a.linescores?.length))),
  };
}

// A small parallel batch keeps this investigation bounded; it is not a collector.
const first = await Promise.all(games.map(id => inspect(`ESPN ${id}`, `${base}/summary?event=${id}`, summarizeESPN)));
const nbaURL = 'https://stats.nba.com/stats/boxscoretraditionalv3?EndPeriod=1&EndRange=0&GameID=0022400061&RangeType=0&StartPeriod=1&StartRange=0';
const nba = await inspect('NBA historical Q1', nbaURL, p => p);
const recentNBA = await inspect('NBA recent Q1', nbaURL.replace('0022400061', '0022600023'), p => p);
const repeat = await inspect('ESPN historical repeat', `${base}/summary?event=401704627`, summarizeESPN);
const archive = await inspect('NBA matchup archive historical', 'https://raw.githubusercontent.com/sportsdataverse/hoopR-nba-stats-raw/main/nba_stats/json/boxscorematchupsv3/2025/0022400061.json', p => ({ gameId: p.boxScoreMatchups?.gameId, teams: ['homeTeam', 'awayTeam'].map(k => ({ side: k, players: p.boxScoreMatchups?.[k]?.players?.length ?? null })) }));
const fixtures = await Promise.all(games.map(async id => ({ id, data: summarizeESPN(JSON.parse(await readFile(new URL(`../server/fixtures/espn-${id}.json`, import.meta.url), 'utf8'))) })));
const report = { checkedAtUTC: new Date().toISOString(), note: 'Small access/schema sample, not proof of coverage or source accuracy. Fixtures are separately labeled, never live fallback.', live: [...first, nba, recentNBA, repeat, archive], savedFixtures: fixtures };
await writeFile(new URL('./source-validation-results.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.live.map(({ label, status, error, cause, data }) => ({ label, status, error, cause, id: data?.id, teams: data?.teams })), null, 2));
