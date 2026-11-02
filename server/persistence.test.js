import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from './store.js';
import { createProvider } from './provider.js';
import { createDataService } from './api.js';
import { teams } from '../src/catalog.js';

// Test the same service/provider/database path used by the UI with controlled
// HTTP responses. No real network, provider account or app data is touched.
test('persistent provider supports offline reopening, corrections and visible failed refreshes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtside-persistence-'));
  let store;
  try {
    const filename = join(directory, 'games.sqlite');
    const game = JSON.parse(await readFile(new URL('./fixtures/espn-401704627.json', import.meta.url), 'utf8'));
    const event = { id: game.header.id, date: game.header.competitions[0].date,
      season: { year: 2025 }, seasonType: { type: 2 },
      competitions: [game.header.competitions[0]] };
    let calls = 0, failed = false, invalid = false;
    const fetcher = async url => {
      calls++;
      if (failed) throw new Error('Test offline');
      return { ok: true, json: async () => url.includes('/schedule?') ? { events: [event] }
        : invalid ? { header: {} } : structuredClone(game) };
    };
    const query = { left: teams.find(t => t.id === 'BOS'), right: teams.find(t => t.id === 'NYK'),
      season: 2025, limit: 3, mode: 'matchup', refresh: false, playerId: '4065648' };
    store = openStore(filename);
    let provider = createProvider({ store, directory, fetcher });
    let service = createDataService(provider);
    const first = await service.comparison(query);
    assert.equal(first.games.length, 1);
    assert.deepEqual(first.warnings, []);
    assert.equal(calls, 3); // Two schedules, one shared game.
    const counts = store.counts();
    await service.comparison(query);
    assert.equal(calls, 3);
    store.close();
    store = openStore(filename);
    provider = createProvider({ store, directory, fetcher });
    service = createDataService(provider);
    failed = true;
    const saved = await service.comparison(query);
    assert.equal(calls, 3);
    assert.equal(saved.savedRecordsUsed, true);
    assert.equal(saved.oldestFetchedAt, first.oldestFetchedAt);
    const fallback = await service.comparison({ ...query, refresh: true });
    assert.equal(fallback.games[0].sides.BOS.stats.pts, 132);
    assert.equal(fallback.warnings.length, 3);
    assert.deepEqual(store.counts(), counts);
    const player = await service.player(query);
    assert.equal(player.games[0].sides.BOS.players.find(p => p.id === query.playerId).stats.pts, 37);
    failed = false;
    const athlete = game.boxscore.players[0].statistics[0].athletes[0];
    athlete.athlete.displayName = 'Corrected name';
    const updated = await service.comparison({ ...query, refresh: true });
    // The second team reuses the game just saved by the first team's scan.
    assert.equal(updated.savedRecordsUsed, true);
    assert.deepEqual(updated.warnings, []);
    assert.equal(store.getGame(game.header.id).raw.boxscore.players[0].statistics[0].athletes[0].athlete.displayName, 'Corrected name');
    assert.deepEqual(store.counts(), counts);
    invalid = true;
    const rejected = await provider.game(game.header.id, true);
    assert.match(rejected.warning, /refresh failed/);
    assert.equal(rejected.data.id, game.header.id);
    failed = true;
    await assert.rejects(provider.game('999999'), /Could not reach/);
    assert.equal(store.getGame('999999'), null);
    assert.deepEqual(store.counts(), counts);
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
