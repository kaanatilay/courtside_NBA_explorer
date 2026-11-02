import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeSchedule, eventClassification } from './normalize.js';
import { createProvider } from './provider.js';
import { openStore } from './store.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/schedule-classification.json', import.meta.url), 'utf8'));
const scope = { season: 2025, type: 2 };
const now = Date.parse('2026-11-02T12:00:00Z');

// Real championship metadata reproduces the provider's misleading type=2.
test('Cup finals are excluded while ordinary NBA Cup games stay regular season', () => {
  const regular = fixture.events[2];
  assert.equal(eventClassification(fixture.events[0]).competitionClass, 'cup-final');
  assert.equal(eventClassification(fixture.events[1]).competitionClass, 'cup-final');
  const semifinal = structuredClone(regular);
  semifinal.id = '123456';
  semifinal.competitions[0].notes = [{ headline: 'NBA Cup Semifinals' }];
  const result = normalizeSchedule({ season: { year: 2027 }, events: [...fixture.events, semifinal] }, now, scope);
  assert.deepEqual(result.map(e => e.id).sort(), [regular.id, semifinal.id].sort());
  assert(result.every(e => e.seasonYear === 2025 && e.seasonType === 2 && e.competitionClass === 'regular-season'));
});

test('event metadata excludes wrong seasons/types and rejects unknown classification', () => {
  const regular = fixture.events[2];
  const playoff = { ...regular, id: '10', seasonType: { type: 3 } };
  const otherYear = { ...regular, id: '11', season: { year: 2026 } };
  assert.equal(normalizeSchedule({ events: [regular, playoff, otherYear] }, now, scope).length, 1);
  const missing = { ...regular, season: undefined };
  assert.throws(() => normalizeSchedule({ events: [missing] }, now, scope), /missing season/);
  assert.deepEqual(normalizeSchedule({ events: [] }, now, scope), []);
});

// Legacy schedule rows must be replaced once, not silently reused or used as a
// fallback on failure. This migration does not delete any game data.
test('legacy saved schedules refetch once; classified schedules persist safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtside-classification-'));
  const store = openStore(join(directory, 'test.sqlite'));
  try {
    store.saveSchedule('2', 2025, { fetchedAt: '2026-11-01T00:00:00Z', data: [{ id: '401734908' }] });
    const offline = createProvider({ store, fetcher: async () => { throw new Error('offline'); } });
    await assert.rejects(offline.schedule('2', 2025), /Could not reach/);
    let calls = 0;
    const provider = createProvider({ store, fetcher: async () => { calls++; return { ok: true, json: async () => ({ events: fixture.events }) }; } });
    const first = await provider.schedule('2', 2025);
    assert.equal(first.data.length, 1);
    assert.equal(store.getSchedule('2', 2025).classificationVersion, 1);
    await provider.schedule('2', 2025);
    assert.equal(calls, 1);
    const fallback = await offline.schedule('2', 2025, true);
    assert.equal(fallback.data.length, 1);
    assert.match(fallback.warning, /refresh failed/);
    const bad = createProvider({ store, fetcher: async () => ({ ok: true, json: async () => ({ events: [{ ...fixture.events[2], season: undefined }] }) }) });
    const invalid = await bad.schedule('2', 2025, true);
    assert.match(invalid.warning, /missing season/);
    assert.deepEqual(invalid.data, first.data);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
