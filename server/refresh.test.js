import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRefreshService } from './refresh.js';
import { createProvider } from './provider.js';
import { openStore } from './store.js';

const league = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1), name: `T${i + 1}` }));
const now = () => new Date('2026-11-02T12:00:00Z');
const event = (id, dateUTC) => ({ id, dateUTC, teamIds: ['1', '2'], seasonYear: 2027, seasonType: 2, competitionClass: 'regular-season' });

// Discovery appears in both teams' schedules. Each unique game must be worked
// once, including older missing games, while old saved games stay untouched.
test('league cycle deduplicates games, bounds corrections and shares a running job', async () => {
  const events = [event('1', '2026-10-10T12:00:00Z'), event('2', '2026-10-26T12:00:00Z'), event('3', '2026-10-11T12:00:00Z')];
  const requests = [];
  let directoryCalls = 0;
  const cycle = createRefreshService({
    leagueTeams: async () => { directoryCalls++; return league; },
    schedule: async (_team, season, refresh) => { assert.equal(season, 2027); assert.equal(refresh, true); return { data: events }; },
    game: async (id, refresh, expected) => { requests.push(id); assert.equal(refresh, true); assert.equal(expected.id, id); return {}; },
  }, { hasGame: id => id !== '3' }, { now });
  cycle.start(); cycle.start();
  await cycle.wait();
  assert.equal(directoryCalls, 1);
  assert.deepEqual(requests.sort(), ['2', '3']); // Exactly seven days is included.
  const status = cycle.status();
  assert.equal(status.state, 'complete'); assert.equal(status.added, 1); assert.equal(status.updated, 1);
  assert.equal(status.olderGamesReused, 1); assert.equal(status.teamsChecked, 30);
  status.failures.push({ message: 'external mutation' });
  assert.equal(cycle.status().failures.length, 0);
});

test('partial cycles report schedule/game failures and continue other work', async () => {
  const cycle = createRefreshService({
    leagueTeams: async () => league,
    schedule: async id => {
      if (id === '1') throw new Error('schedule unavailable');
      return { data: [event('1', '2026-11-01T12:00:00Z'), event('2', '2026-11-01T13:00:00Z')], warning: id === '2' ? 'using old schedule' : undefined };
    },
    game: async id => id === '1' ? { warning: 'saved game retained after failed download' } : {},
  }, { hasGame: () => false }, { now });
  cycle.start(); await cycle.wait();
  const status = cycle.status();
  assert.equal(status.state, 'partial'); assert.equal(status.failures.length, 3);
  assert.equal(status.added, 1); assert.equal(status.gamesChecked, 2);
  const failed = createRefreshService({ leagueTeams: async () => { throw new Error('directory offline'); } }, {}, { now });
  failed.start(); await failed.wait(); assert.equal(failed.status().state, 'failed');
});

// Exercise actual storage and provider normalization: repeated cycles update
// existing rows instead of accumulating copies, with both teams/all players saved.
test('two league cycles persist actual fixtures without duplicate game/player rows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtside-cycle-'));
  const store = openStore(join(directory, 'games.sqlite'));
  try {
    const fixtures = await Promise.all(['401704627', '401703371'].map(async id => JSON.parse(await readFile(new URL(`./fixtures/espn-${id}.json`, import.meta.url), 'utf8'))));
    store.importGame(fixtures[1]);
    const calls = [];
    const provider = createProvider({ store, fetcher: async url => {
      calls.push(url);
      let payload;
      if (url.endsWith('/teams?limit=100')) payload = { sports: [{ leagues: [{ teams: league.map(team => ({ team: { ...team, abbreviation: team.name } })) }] }] };
      else if (url.includes('/schedule?')) payload = { events: fixtures.map(p => ({ id: p.header.id, date: p.header.competitions[0].date, season: { year: 2025 }, seasonType: { type: 2 }, competitions: p.header.competitions })) };
      else payload = fixtures.find(p => url.endsWith(`event=${p.header.id}`));
      return { ok: true, json: async () => structuredClone(payload) };
    } });
    const cycle = createRefreshService(provider, store, { now: () => new Date('2024-11-15T12:00:00Z') });
    cycle.start(); await cycle.wait();
    assert.equal(cycle.status().state, 'complete');
    assert.equal(cycle.status().added, 1); assert.equal(cycle.status().updated, 1);
    const counts = store.counts(); assert.equal(counts.games, 2); assert.equal(counts.team_games, 4);
    cycle.start(); await cycle.wait();
    assert.equal(cycle.status().added, 0); assert.equal(cycle.status().updated, 1);
    assert.equal(cycle.status().olderGamesReused, 1);
    assert.deepEqual(store.counts(), counts);
    assert.equal(calls.filter(url => url.includes('event=401704627')).length, 1);
    assert.equal(calls.filter(url => url.includes('event=401703371')).length, 2);
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
});
