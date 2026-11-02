import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { normalizeGame, normalizeSchedule, numeric, minutes } from './normalize.js';
import { createDataService, parseQuery } from './api.js';
import { createProvider } from './provider.js';
import { teams, currentSeason } from '../src/catalog.js';

// A compact provider-shaped fixture covers a final overtime game, reordered
// player labels, missing metrics, and a DNP without needing a live connection.
function boxFixture() {
  return {
    header: { id: '101', competitions: [{ date: '2026-10-31T02:00Z', status: { type: { completed: true } }, competitors: [
      { team: { id: '13', abbreviation: 'LAL' }, score: '110', linescores: [25, 25, 25, 25, 10].map(value => ({ displayValue: String(value) })) },
      { team: { id: '9', abbreviation: 'GS' }, score: '109', linescores: [25, 25, 25, 25, 9].map(value => ({ displayValue: String(value) })) },
    ] }] },
    boxscore: {
      teams: ['13', '9'].map(id => ({ team: { id }, statistics: [{ name: 'assists', displayValue: '20' }] })),
      players: ['13', '9'].map(id => ({ team: { id }, statistics: [{ labels: ['PTS', 'MIN', 'AST'], athletes: [
        { athlete: { id: '7', displayName: 'Test Player' }, didNotPlay: false, stats: ['12', '30:30', '0'] },
        { athlete: { id: '8', displayName: 'Missed Game' }, didNotPlay: true, stats: ['0', '0', '0'] },
      ] }] })),
    },
  };
}

test('normalization retains OT, dates, label mapping, DNP and absent fields', () => {
  const game = normalizeGame(boxFixture());
  assert.equal(game.date, '2026-10-30');
  assert.equal(game.sides.LAL.stats.pts, 110);
  assert.equal(game.sides.GSW.periods.length, 5);
  assert.equal(game.sides.LAL.stats.blk, null);
  assert.equal(game.sides.LAL.players[0].stats.min, 30.5);
  assert.equal(game.sides.LAL.players[0].stats.ast, 0);
  assert.equal(game.sides.LAL.players[1].played, false);
  assert.equal(numeric('--'), null);
  assert.equal(minutes('12:99'), null);
  const mismatch = boxFixture();
  mismatch.header.competitions[0].competitors[0].score = '111';
  assert.deepEqual(normalizeGame(mismatch).sides.LAL.periods, []);
  assert.throws(() => normalizeGame({}), /not final/);
});

test('schedules exclude unfinished games and sort by actual timestamp', () => {
  const event = (id, date, completed) => ({ id, date, competitions: [{ status: { type: { completed } }, competitors: [{ team: { id: '13' } }, { team: { id: '9' } }] }] });
  const data = { events: [event('1', '2026-10-01', true), event('2', '2026-10-03', false), event('3', '2026-10-02', true), event('1', '2026-10-01', true)] };
  assert.deepEqual(normalizeSchedule(data, Date.parse('2026-11-01')).map(game => game.id), ['3', '1']);
});

test('player last N scans beyond DNPs and filters opponents before taking N', async () => {
  const timestamp = '2026-10-31T12:00:00Z';
  const schedule = [
    { id: '1', teamIds: ['13', '9'] }, { id: '2', teamIds: ['13', '2'] },
    { id: '3', teamIds: ['13', '9'] }, { id: '4', teamIds: ['13', '9'] }, { id: '5', teamIds: ['13', '9'] },
  ];
  const requested = [];
  const service = createDataService({
    schedule: async () => ({ data: schedule, fetchedAt: timestamp }),
    game: async id => {
      requested.push(id);
      return { fetchedAt: timestamp, data: { id, sides: {
        LAL: { players: [{ id: '7', played: id !== '1' }] }, [id === '2' ? 'BOS' : 'GSW']: { players: [] },
      } } };
    },
  });
  const query = { left: teams[1], right: teams[2], season: currentSeason(), limit: 3, mode: 'matchup', playerId: '7', refresh: false };
  const result = await service.player(query);
  assert.deepEqual(result.games.map(game => game.id), ['3', '4', '5']);
  assert.deepEqual(requested, ['1', '3', '4', '5']);
  assert.equal(result.inspected, 4);
  const short = await service.player({ ...query, limit: 10 });
  assert.equal(short.games.length, 3);
});

test('filters reject arbitrary team IDs, unsupported seasons and sample sizes', () => {
  const valid = new URLSearchParams({ left: 'BOS', right: 'LAL', season: String(currentSeason()), mode: 'recent', limit: '3' });
  assert.equal(parseQuery(valid).left.id, 'BOS');
  valid.set('limit', '1000');
  assert.throws(() => parseQuery(valid), /Invalid/);
});

test('cache reuses responses, refreshes explicitly, and surfaces upstream failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtside-test-'));
  let calls = 0;
  let fail = false;
  const provider = createProvider({ directory, fetcher: async () => {
    calls++;
    return fail ? { ok: false, status: 503 } : { ok: true, json: async () => boxFixture() };
  } });
  try {
    // A fresh legacy cache must be replaced now that the normalized schema
    // includes derived quarter counts and their validation results.
    await writeFile(join(directory, 'game-101.json'), JSON.stringify({ version: 2, fetchedAt: new Date().toISOString(), data: { id: 'old-parser' } }));
    await provider.game('101');
    await provider.game('101');
    assert.equal(calls, 1);
    await provider.game('101', true);
    assert.equal(calls, 2);
    fail = true;
    await assert.rejects(provider.game('101', true), /503/);
    const cache = JSON.parse(await readFile(join(directory, 'game-101.json'), 'utf8'));
    assert.equal(cache.data.id, '101');
    assert.equal(cache.version, 3);
  } finally {
    // Remove only the unique temporary test folder just created above.
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.split(/[\\/]/).at(-1).startsWith('courtside-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
