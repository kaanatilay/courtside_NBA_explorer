import { mkdir, writeFile, readFile } from 'node:fs/promises';

const rawBase = 'https://raw.githubusercontent.com/sportsdataverse/hoopR-nba-stats-raw/main/nba_stats/json';
const releaseBase = 'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_stats_team_boxscores';
const output = new URL('./sdv-period-samples/', import.meta.url);
await mkdir(output, { recursive: true });

// Minimal RFC-style CSV reader: respect quoted commas, quotes, and newlines.
// Game IDs stay strings so leading zeroes cannot be lost during joins.
function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else value += char;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift();
  return { headers, rows: rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((name, i) => [name, row[i]]))) };
}

// Bound requests and save exact source URLs. Failed requests are evidence,
// not empty datasets that could be mistaken for a zero-stat performance.
async function retrieve(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

const tables = {};
const assets = [];
for (const season of [2024, 2025, 2027]) {
  const source = `${releaseBase}/team_boxscores_${season}.csv`;
  const table = parseCsv(await retrieve(source));
  tables[season] = table;
  assets.push({ source, season, rows: table.rows.length, games: new Set(table.rows.map(row => row.game_id)).size, headers: table.headers,
    containsPeriodColumn: table.headers.some(header => /period|quarter/i.test(header)) });
}

// These files are period-start lineup snapshots, not full-quarter totals.
// The comparisons below deliberately test (and reject) using them as quarters.
// Select known cross-source examples plus a genuine OT observation, discovered
// from the published team minutes rather than guessing a game identifier.
const overtime = tables[2025].rows.find(row => Number(row.minutes.split(':')[0]) > 240 && row.game_id.startsWith('002'));
if (!overtime) throw new Error('No overtime example was found.');
const selected = [
  { season: 2025, id: '0022400061', espnId: '401704627', reason: 'Known historical Celtics–Knicks game' },
  { season: 2027, id: '0022600023', espnId: '401909285', reason: 'Recent Lakers–Warriors game' },
  { season: 2024, id: '0022301167', reason: 'Older Celtics–Knicks game' },
  { season: 2025, id: overtime.game_id, reason: 'Overtime game selected from published full-game minutes' },
];

const metrics = { points: 'points', assists: 'assists', reboundsOffensive: 'rebounds_offensive', reboundsDefensive: 'rebounds_defensive', blocks: 'blocks' };
const toSeconds = value => {
  if (!/^\d+:\d{2}$/.test(value || '')) return null;
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
};
const knownEspn = JSON.parse(await readFile(new URL('./verified-samples.json', import.meta.url), 'utf8'));
const espnSamples = [...knownEspn.recent, knownEspn.historical];
const results = [];

for (const sample of selected) {
  const source = `${rawBase}/boxscoretraditionalv3_period/${sample.season}/${sample.id}.json`;
  try {
    const text = await retrieve(source);
    await writeFile(new URL(`${sample.id}.json`, output), text);
    const periods = JSON.parse(text);
    const fullText = await retrieve(`${rawBase}/boxscoretraditionalv3/${sample.season}/${sample.id}.json`);
    const fullBox = JSON.parse(fullText).boxScoreTraditional;
    const records = Object.entries(periods).sort(([a], [b]) => Number(a) - Number(b));
    const sides = ['homeTeam', 'awayTeam'].map(side => {
      const team = records[0][1].boxScoreTraditional[side];
      const publishedFull = tables[sample.season].rows.find(row => row.game_id === sample.id && row.team_id === String(team.teamId));
      if (!publishedFull) throw new Error('Cannot join period team to published full-game record.');
      const expected = Object.fromEntries(Object.entries(metrics).map(([key, column]) => [key, Number(publishedFull[column])]));
      const observed = Object.fromEntries(Object.keys(metrics).map(key => [key, records.reduce((sum, [, data]) => sum + data.boxScoreTraditional[side].statistics[key], 0)]));
      const differences = Object.fromEntries(Object.keys(metrics).map(key => [key, observed[key] - expected[key]]));
      const matchingEspn = espnSamples.find(game => game.eventId === sample.espnId)?.teams.find(item => item.team === team.teamTricode || (item.team === 'GS' && team.teamTricode === 'GSW') || (item.team === 'NY' && team.teamTricode === 'NYK'));
      const periodRows = records.map(([period, data]) => ({ period: Number(period), capturedAt: data.meta?.time,
        ...Object.fromEntries(Object.keys(metrics).map(key => [key, data.boxScoreTraditional[side].statistics[key]])), minutes: data.boxScoreTraditional[side].statistics.minutes }));
      const playerComparisons = fullBox[side].players.filter(player => toSeconds(player.statistics.minutes) > 0).map(player => {
        const rows = records.map(([, data]) => data.boxScoreTraditional[side].players.find(row => row.personId === player.personId));
        return { id: player.personId, name: `${player.firstName} ${player.familyName}`, fullGamePoints: player.statistics.points,
          summedPeriodPoints: rows.reduce((sum, row) => sum + (row?.statistics.points || 0), 0),
          fullGameSeconds: toSeconds(player.statistics.minutes),
          summedPeriodSeconds: rows.reduce((sum, row) => sum + (toSeconds(row?.statistics.minutes) || 0), 0) };
      });
      return { team: team.teamTricode, expected, summedPeriods: observed, differences, periodRows,
        espnPeriodPoints: matchingEspn?.periodPoints || null,
        espnQuarterPointsMatch: matchingEspn ? periodRows.every((row, i) => row.points === matchingEspn.periodPoints[i]) : null,
        playerComparisons };
    });
    results.push({ ...sample, source, periodKeys: records.map(([key]) => key), sides, validTeamTotals: sides.every(team => Object.values(team.differences).every(value => value === 0)) });
  } catch (error) { results.push({ ...sample, source, error: error.message }); }
}

// Release metadata gives actual asset timestamps; descriptive release prose
// can lag behind newly added current-season assets.
const release = JSON.parse(await retrieve('https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/nba_stats_team_boxscores'));
const metadata = release.assets.filter(asset => /team_boxscores_202[457]\.csv$/.test(asset.name)).map(asset => ({ name: asset.name, bytes: asset.size, updatedAt: asset.updated_at }));
const report = { checkedAtUTC: new Date().toISOString(), scope: 'Four selected games; folder presence is not completeness. No app integration.',
  sourcePurpose: 'The source captures a one-second window at period starts for lineup reconstruction. validTeamTotals tests suitability as FULL-quarter totals, not correctness as a lineup snapshot.',
  sourceExplanation: 'https://github.com/sportsdataverse/sportsdataverse-py/blob/main/sportsdataverse/scrape/stats/periods.py', assets, metadata, results };
await writeFile(new URL('./sdv-period-validation.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ metadata, assets: assets.map(({ headers, ...rest }) => rest), games: results.map(game => ({ id: game.id, reason: game.reason, periodKeys: game.periodKeys, error: game.error, validTeamTotals: game.validTeamTotals,
  teams: game.sides?.map(team => ({ team: team.team, pointsExpected: team.expected.points, pointsFromPeriods: team.summedPeriods.points, espnQuarterPointsMatch: team.espnQuarterPointsMatch,
    playersChecked: team.playerComparisons.length, playerPointMatches: team.playerComparisons.filter(player => player.fullGamePoints === player.summedPeriodPoints).length,
    playerMinuteMatches: team.playerComparisons.filter(player => player.fullGameSeconds === player.summedPeriodSeconds).length })) })) }, null, 2));
