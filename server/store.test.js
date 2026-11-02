import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.js';

// Real saved games exercise persistence and replacement without network access.
test('store persists games, deduplicates, queries players, and rolls back bad updates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'courtside-store-'));
  let store;
  try {
    const fixtures = await Promise.all(['401704627', '401909285', '401703371'].map(async id =>
      JSON.parse(await readFile(new URL(`./fixtures/espn-${id}.json`, import.meta.url), 'utf8'))));
    const file = join(dir, 'sample.sqlite');
    store = openStore(file);
    for (const p of fixtures) store.importGame(p);
    const counts = store.counts();
    assert.equal(counts.games, 3);
    assert.equal(counts.team_games, 6);
    const expectedRows = fixtures.reduce((n, p) => n + p.boxscore.players.reduce((m, t) => m + t.statistics.reduce((k, g) => k + g.athletes.length, 0), 0), 0);
    assert.equal(counts.player_games, expectedRows);
    for (const p of fixtures) store.importGame(p);
    assert.deepEqual(store.counts(), counts);
    assert.equal(store.playerAppearances('4065648')[0].record.stats.pts, 37);
    assert.equal(store.playerAppearances('3945274')[0].record.stats.pts, 37);
    assert.deepEqual(store.playerAppearances('unknown'), []);
    assert.equal(store.teamGames('8')[0].record.periods.length, 5); // Detroit, outside the UI's four-team catalog.
    const dnp = fixtures.flatMap(p => p.boxscore.players.flatMap(t => t.statistics.flatMap(g => g.athletes))).find(a => a.didNotPlay);
    if (dnp) assert.equal(store.playerAppearances(dnp.athlete.id).some(r => r.record.played === false), false);
    store.close();
    store = openStore(file);
    assert.deepEqual(store.counts(), counts);
    assert.equal(store.getGame('401704627').fetched_at, fixtures[0].capturedAt);

    // A valid correction replaces the game instead of adding another copy.
    const corrected = structuredClone(fixtures[0]);
    corrected.boxscore.players[0].statistics[0].athletes[0].athlete.displayName = 'Corrected display name';
    store.importGame(corrected, { fetchedAt: '2026-11-02T12:00:00Z' });
    assert.equal(store.getGame('401704627').raw.boxscore.players[0].statistics[0].athletes[0].athlete.displayName, 'Corrected display name');
    assert.deepEqual(store.counts(), counts);
    const previous = store.getGame('401704627');
    const invalid = structuredClone(corrected);
    invalid.header.competitions[0].status.type.completed = false;
    assert.throws(() => store.importGame(invalid));
    assert.deepEqual(store.getGame('401704627'), previous);

    // Duplicate player IDs fail during insertion, after old rows were deleted;
    // rollback must restore both raw data and all queryable records.
    const duplicate = structuredClone(corrected);
    const group = duplicate.boxscore.players[0].statistics[0];
    group.athletes.push(structuredClone(group.athletes[0]));
    assert.throws(() => store.importGame(duplicate));
    assert.deepEqual(store.getGame('401704627'), previous);
    assert.deepEqual(store.counts(), counts);
    assert.equal(store.playerAppearances('4065648')[0].record.stats.pts, 37);
  } finally {
    store?.close();
    // Only remove the test directory returned by mkdtemp, never project data.
    await rm(dir, { recursive: true, force: true });
  }
});
