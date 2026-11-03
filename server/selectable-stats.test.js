import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeGame, shootingPair } from './normalize.js';
import { average, metricValue, rowsFor } from '../src/stats.js';
import { selectedMetrics, cleanMetricSelection } from '../src/catalog.js';

test('saved box scores expose requested team/player shooting and steals without new downloads', async () => {
  const p = JSON.parse(await readFile(new URL('./fixtures/espn-401704627.json', import.meta.url), 'utf8'));
  const game = normalizeGame(p);
  // Independently read values from the saved provider-shaped box score.
  assert.equal(game.sides.NYK.stats.ftm, 12); assert.equal(game.sides.NYK.stats.fta, 16);
  assert.equal(game.sides.NYK.stats.tpm, 11); assert.equal(game.sides.NYK.stats.tpa, 30);
  assert.equal(game.sides.NYK.stats.stl, 2);
  assert.equal(game.sides.NYK.stats.leadChanges, null); // Absent in this old fixture.
  const og = game.sides.NYK.players.find(p => p.name === 'OG Anunoby');
  assert.equal(og.stats.ftm, 2); assert.equal(og.stats.fta, 2);
  assert.equal(og.stats.tpm, 0); assert.equal(og.stats.tpa, 4); assert.equal(og.stats.stl, 1);
  assert.equal(metricValue(og.stats, 'ftPct'), 100);
  assert.equal(metricValue(og.stats, 'tpPct'), 0);
  p.boxscore.teams[0].statistics.push({ name: 'leadChanges', displayValue: '7' });
  assert.equal(normalizeGame(p).sides.NYK.stats.leadChanges, 7);
  assert.equal(rowsFor([game], 'NYK', '1')[0].stl, 1);
});

test('shooting rejects missing/impossible pairs and distinguishes zero attempts from zero makes', () => {
  for (const value of [undefined, null, '--', '2', '3-2', '-1-4', '1.5-3', 'NaN-3']) assert.deepEqual(shootingPair(value), [null, null]);
  assert.deepEqual(shootingPair('0-0'), [0, 0]);
  assert.deepEqual(shootingPair(' 2 - 4 '), [2, 4]);
  assert.equal(metricValue({ ftm: 0, fta: 0 }, 'ftPct'), null);
  assert.equal(metricValue({ ftm: 0, fta: 3 }, 'ftPct'), 0);
  assert.equal(average([{ ftm: 1, fta: 1 }, { ftm: 0, fta: 9 }], 'ftPct'), 10);
  assert.equal(average([{ ftm: 0, fta: 0 }, { ftm: 2, fta: 4 }], 'ftPct'), 50);
  assert.equal(average([{ tpm: 1, tpa: 2 }, { tpm: null, tpa: null }], 'tpPct'), null);
  assert.equal(average([], 'ftPct'), null);
});

test('stored stat choices exclude unknown keys and player lead changes while enabling team quarters', () => {
  const keys = cleanMetricSelection(['pts', 'stl', 'ftPct', 'leadChanges', 'stl', 'made-up']);
  assert.deepEqual(keys, ['pts', 'stl', 'ftPct', 'leadChanges']);
  assert.deepEqual(selectedMetrics(keys, { player: true }).map(([key]) => key), ['pts', 'stl', 'ftPct']);
  assert.deepEqual(selectedMetrics(keys, { quarter: '1' }).map(([key]) => key), ['pts', 'stl', 'ftPct', 'leadChanges']);
  assert.equal(cleanMetricSelection(null).length, 5);
});
