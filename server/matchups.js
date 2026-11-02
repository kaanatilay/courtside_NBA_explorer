import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const releases = 'https://github.com/sportsdataverse/sportsdataverse-data/releases/download';
const archive = 'https://raw.githubusercontent.com/sportsdataverse/hoopR-nba-stats-raw/main/nba_stats/json';
const directoryDefault = fileURLToPath(new URL('../.data-cache/', import.meta.url));

// Release CSVs contain quoted names/commas. Parse quotes explicitly rather than
// splitting columns on commas and accidentally assigning another player's ID.
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) throw new Error('The identity archive contains an invalid CSV.');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
}

const cleanName = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const count = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

// Use date AND home/away teams to map games. Scores, when archived, must also
// agree. Refuse ambiguous IDs instead of guessing from a similar name/date.
export function identifyGame(game, schedule, season) {
  const entries = Object.entries(game.sides);
  const home = entries.find(([, side]) => side.homeAway === 'home');
  const away = entries.find(([, side]) => side.homeAway === 'away');
  if (!home || !away || entries.length !== 2) return null;
  const matches = schedule.filter(row => row.season === String(season) && row.season_type === 'regular-season'
    && row.game_date === game.date && row.home_team_abbreviation === home[0] && row.away_team_abbreviation === away[0]
    && [row.home_pts === '' || Number(row.home_pts) === home[1].stats.pts,
      row.away_pts === '' || Number(row.away_pts) === away[1].stats.pts].every(Boolean));
  return matches.length === 1 && /^\d{10}$/.test(matches[0].game_id) ? matches[0] : null;
}

// NBA v3's outer player is offense; nested matchups are defenders. See the
// nba_api parser's Off/Def headers. Missing tracking/identity stays unavailable.
export function normalizeMatchups(payload, { nbaGame, team, player, crosswalk }) {
  const unavailable = reason => ({ available: false, reason, defenders: [] });
  const box = payload.boxScoreMatchups;
  if (!box || String(box.gameId) !== nbaGame.game_id) return unavailable('The NBA archive did not return the verified game.');
  if (String(box.homeTeamId) !== nbaGame.home_team_id || String(box.awayTeamId) !== nbaGame.away_team_id) return unavailable('NBA and ESPN game teams could not be verified.');
  // The already-verified NBA schedule supplies the team's ID for every club;
  // avoid a second mapping limited to the original four interface teams.
  const teamId = nbaGame.home_team_abbreviation === team ? nbaGame.home_team_id
    : nbaGame.away_team_abbreviation === team ? nbaGame.away_team_id : null;
  const side = [box.homeTeam, box.awayTeam].find(value => teamId && String(value?.teamId) === teamId);
  if (!side?.players?.length) return unavailable('Defender tracking is not available in the archive for this game.');
  const identities = crosswalk.filter(row => row.espn_athlete_id === player.id && Number(row.match_confidence) === 1 && /^\d+$/.test(row.nba_player_id));
  const ids = [...new Set(identities.map(row => row.nba_player_id))];
  if (ids.length !== 1) return unavailable('A unique, high-confidence ESPN-to-NBA player ID is not available.');
  const attackers = side.players.filter(value => String(value.personId) === ids[0]);
  const attacker = attackers[0];
  if (attackers.length !== 1 || cleanName(`${attacker.firstName} ${attacker.familyName}`) !== cleanName(player.name)) return unavailable('The player identity could not be verified in this game.');
  const opponent = side === box.homeTeam ? box.awayTeam : box.homeTeam;
  const expectedOpponent = side === box.homeTeam ? nbaGame.away_team_id : nbaGame.home_team_id;
  if (String(opponent?.teamId) !== expectedOpponent) return unavailable('The opponent roster could not be verified.');
  const roster = new Set((opponent.players || []).map(value => String(value.personId)));
  const seen = new Set();
  const defenders = [];
  for (const defender of attacker.matchups || []) {
    const id = String(defender.personId), stats = defender.statistics || {};
    if (!roster.has(id) || seen.has(id)) return unavailable('Defender identities are missing or duplicated in the archived record.');
    seen.add(id);
    // Sort uses NBA's precise seconds; the displayed clock is rounded upstream.
    const seconds = stats.matchupMinutesSort;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || !/^\d+:\d{2}$/.test(stats.matchupMinutes || '')) return unavailable('Matchup time is incomplete in the archive.');
    defenders.push({ id, name: `${defender.firstName} ${defender.familyName}`, seconds, time: stats.matchupMinutes,
      pts: count(stats.playerPoints), ast: count(stats.matchupAssists), turnovers: count(stats.matchupTurnovers), blocks: count(stats.matchupBlocks),
      fgm: count(stats.matchupFieldGoalsMade), fga: count(stats.matchupFieldGoalsAttempted),
      threeMade: count(stats.matchupThreePointersMade), threeAttempted: count(stats.matchupThreePointersAttempted) });
  }
  defenders.sort((a, b) => b.seconds - a.seconds || a.id.localeCompare(b.id));
  if (!defenders.length || defenders[0].seconds === 0) return unavailable('No timed defender matchups were recorded for this player.');
  return { available: true, nbaPlayerId: ids[0], primaryIds: defenders.filter(row => row.seconds === defenders[0].seconds).map(row => row.id), defenders };
}

// The browser calls our local server. It downloads only the requested game's
// public NBA Stats archive; cached downloads are retried hourly, including gaps.
export function createMatchupService(provider, { fetcher = fetch, directory = directoryDefault } = {}) {
  const pending = new Map();
  async function load(key, url, format, refresh) {
    const file = join(directory, `nba-matchup-v1-${key}.json`);
    if (!refresh) {
      try { const record = JSON.parse(await readFile(file, 'utf8')); if (Date.now() - Date.parse(record.fetchedAt) < 3600_000) return record; }
      catch { /* A missing/damaged cache is downloaded again. */ }
    }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
      if (response.status === 404) return { data: null, fetchedAt: new Date().toISOString() };
      if (!response.ok) throw new Error(`The NBA archive returned HTTP ${response.status}. Retry later.`);
      const data = format === 'json' ? await response.json() : parseCsv(format === 'gzip' ? gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8') : await response.text());
      const record = { data, fetchedAt: new Date().toISOString() };
      await mkdir(directory, { recursive: true });
      await writeFile(file, JSON.stringify(record));
      return record;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  return async function matchups({ gameId, playerId, team, season, refresh }) {
    const game = (await provider.game(gameId, refresh)).data;
    if (game.id !== gameId) throw new Error('ESPN returned a different game.');
    const player = game.sides[team]?.players.find(value => value.id === playerId && value.played);
    if (!player) throw new Error('The selected player did not appear for this team in this game.');
    const missing = reason => ({ available: false, reason, defenders: [], provider: 'NBA Stats via SportsDataverse', gameId, playerId });
    const schedule = await load(`schedule-${season}`, `${releases}/nba_stats_schedules/nba_schedule_${season}.csv.gz`, 'gzip', refresh);
    const nbaGame = identifyGame(game, schedule.data || [], season);
    if (!nbaGame) return missing('This ESPN game could not be uniquely matched to the archived NBA schedule.');
    const crosswalk = await load(`players-${season}`, `${releases}/nba_crosswalk/nba_player_crosswalk_${season}.csv`, 'csv', refresh);
    const source = `${archive}/boxscorematchupsv3/${season}/${nbaGame.game_id}.json`;
    const record = await load(`game-${nbaGame.game_id}`, source, 'json', refresh);
    if (!record.data) return { ...missing('Defender tracking has not been published in this archive for this game.'), source };
    return { ...normalizeMatchups(record.data, { nbaGame, team, player, crosswalk: crosswalk.data || [] }),
      provider: 'NBA Stats via SportsDataverse', gameId, playerId, nbaGameId: nbaGame.game_id, source,
      fetchedAt: record.fetchedAt, archivedAt: record.data.meta?.time || null };
  };
}
