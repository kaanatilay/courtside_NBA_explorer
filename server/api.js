import { teams, currentSeason } from '../src/catalog.js';
import { createProvider } from './provider.js';
import { createMatchupService } from './matchups.js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { createRefreshService } from './refresh.js';

// Matchup requests identify one completed appearance, never a remote URL.
export function parseMatchupQuery(params) {
  const team = params.get('team'), gameId = params.get('game'), playerId = params.get('player');
  const season = Number(params.get('season'));
  if (!teams.some(value => value.id === team) || !/^\d{1,12}$/.test(gameId || '') || !/^\d{1,12}$/.test(playerId || '')
    || !Number.isInteger(season) || season < currentSeason() - 2 || season > currentSeason()) throw new Error('Invalid defender-matchup filters.');
  return { team, gameId, playerId, season, refresh: params.get('refresh') === '1' };
}

// Bound all inputs: clients cannot supply arbitrary URLs or filesystem paths.
export function parseQuery(searchParams, player = false) {
  const left = teams.find(team => team.id === searchParams.get('left'));
  const right = teams.find(team => team.id === searchParams.get('right'));
  const season = Number(searchParams.get('season'));
  const limit = Number(searchParams.get('limit'));
  const mode = searchParams.get('mode');
  const playerId = searchParams.get('player');
  if (!left || !right || left.id === right.id || ![3, 5, 10].includes(limit)
    || !['recent', 'matchup'].includes(mode) || !Number.isInteger(season)
    || season < currentSeason() - 2 || season > currentSeason()
    || (player && !/^\d{1,12}$/.test(playerId || ''))) throw new Error('Invalid comparison filters.');
  return { left, right, season, limit, mode, playerId, refresh: searchParams.get('refresh') === '1' };
}

// Player scans continue beyond missed team games until N appearances or the
// end of the chosen season. Provider failure aborts rather than hiding a gap.
export function createDataService(provider) {
  async function sample(team, opponent, query, playerId = null, refreshed = new Set()) {
    const scheduleKey = `schedule-${team.id}`;
    const schedule = await provider.schedule(team.providerId, query.season, query.refresh && !refreshed.has(scheduleKey));
    refreshed.add(scheduleKey);
    const candidates = schedule.data.filter(event => query.mode !== 'matchup' || event.teamIds.includes(opponent.providerId));
    const included = [];
    const fetchedTimes = [schedule.fetchedAt];
    const records = [schedule];
    let inspected = 0;
    for (const event of candidates) {
      const record = await provider.game(event.id, query.refresh && !refreshed.has(event.id));
      refreshed.add(event.id);
      fetchedTimes.push(record.fetchedAt);
      records.push(record);
      const side = record.data.sides[team.id];
      if (!side || (query.mode === 'matchup' && !record.data.sides[opponent.id])) throw new Error('ESPN schedule and box-score teams do not agree.');
      inspected++;
      if (!playerId || side.players.some(player => player.id === playerId && player.played)) included.push(record.data);
      if (included.length >= query.limit) break;
    }
    return { games: included, inspected, available: candidates.length, fetchedTimes, records };
  }
  const metadata = samples => ({
    provider: 'ESPN', seasonScope: 'Selected regular season only; provider schedule coverage may be incomplete.',
    oldestFetchedAt: samples.flatMap(sample => sample.fetchedTimes).sort()[0], checkedAt: new Date().toISOString(),
    warnings: [...new Set(samples.flatMap(sample => sample.records.map(record => record.warning).filter(Boolean)))],
    savedRecordsUsed: samples.some(sample => sample.records.some(record => record.storage === 'saved')),
  });
  return {
    async comparison(query) {
      // Modest sequential scans reuse cached games shared by the samples.
      const refreshed = new Set();
      const first = await sample(query.left, query.right, query, null, refreshed);
      const second = await sample(query.right, query.left, query, null, refreshed);
      return { ...metadata([first, second]), games: [...new Map([...first.games, ...second.games].map(game => [game.id, game])).values()],
        samples: { [query.left.id]: first.games.map(game => game.id), [query.right.id]: second.games.map(game => game.id) } };
    },
    async player(query) {
      const selected = await sample(query.left, query.right, query, query.playerId);
      return { ...metadata([selected]), games: selected.games, inspected: selected.inspected, available: selected.available };
    },
  };
}

// Vite hosts the Node data service and React together: one launch command,
// one browser origin, and no Python server or extra dependency required.
export function nbaDataPlugin() {
  // Opening lazily keeps the frontend build from creating a data file.
  const directory = fileURLToPath(new URL('../.local-data/', import.meta.url));
  let store;
  const getStore = () => {
    if (!store) { mkdirSync(directory, { recursive: true }); store = openStore(fileURLToPath(new URL('../.local-data/games.sqlite', import.meta.url))); }
    return store;
  };
  const persistentStore = new Proxy({}, { get: (_target, key) => (...args) => getStore()[key](...args) });
  const provider = createProvider({ store: persistentStore });
  const refreshService = createRefreshService(provider, persistentStore);
  const service = { ...createDataService(provider), matchups: createMatchupService(provider) };
  const install = server => { server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/api/refresh') {
      // Mutating refresh uses POST; reject cross-origin browser submissions.
      if (req.method === 'GET') { res.end(JSON.stringify(refreshService.status())); return; }
      if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Use GET for status or POST to start refresh.' })); return; }
      const origin = req.headers.origin;
      if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== `http://${req.headers.host}`)) {
        res.statusCode = 403; res.end(JSON.stringify({ error: 'Refresh must be started from this app.' })); return;
      }
      res.statusCode = 202;
      res.end(JSON.stringify(refreshService.start())); return;
    }
    if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Only GET requests are supported.' })); return; }
    const isPlayer = url.pathname === '/api/player';
    const isMatchup = url.pathname === '/api/matchups';
    if (!isMatchup && !isPlayer && url.pathname !== '/api/comparison') { res.statusCode = 404; res.end(JSON.stringify({ error: 'Unknown data endpoint.' })); return; }
    let query;
    try { query = isMatchup ? parseMatchupQuery(url.searchParams) : parseQuery(url.searchParams, isPlayer); }
    catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); return; }
    try { res.end(JSON.stringify(await service[isMatchup ? 'matchups' : isPlayer ? 'player' : 'comparison'](query))); }
    catch (error) { res.statusCode = 502; res.end(JSON.stringify({ error: error.message })); }
  }); };
  return { name: 'nba-local-data', configureServer: install, configurePreviewServer: install,
    async closeBundle() { await refreshService.wait(); store?.close(); store = undefined; } };
}
