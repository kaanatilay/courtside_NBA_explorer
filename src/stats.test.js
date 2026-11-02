import test from 'node:test';
import assert from 'node:assert/strict';
import { average, rowsFor } from './stats.js';

const game = { id: '1', date: '2026-10-30', sides: {
  LAL: { stats: { pts: 110, ast: 20 }, periods: [{ pts: 25 }, { pts: 25 }, { pts: 25 }, { pts: 25 }, { pts: 10 }],
    players: [{ id: 'p', played: true, stats: { min: 30, pts: 20 } }, { id: 'dnp', played: false, stats: { min: 0, pts: 0 } }] },
  GSW: { stats: { pts: 109 }, periods: [], players: [] },
} };

test('full games retain overtime; periods expose only verified metrics', () => {
  assert.equal(rowsFor([game], 'LAL')[0].pts, 110);
  assert.equal(rowsFor([game], 'LAL', '1')[0].pts, 25);
  assert.equal(average(rowsFor([game], 'LAL', '1'), 'ast'), null);
  assert.equal(average(rowsFor([game], 'GSW', '1'), 'pts'), null);
});

test('missing observations and empty samples are unavailable, not zero', () => {
  assert.equal(average([], 'pts'), null);
  assert.equal(average([{ pts: 2 }, { pts: null }], 'pts'), null);
  assert.equal(average([{ pts: 0 }, { pts: 2 }], 'pts'), 1);
});

test('player DNPs are excluded; quarter minutes are unavailable', () => {
  assert.equal(rowsFor([game], 'LAL', 'all', 'dnp').length, 0);
  assert.equal(rowsFor([game], 'LAL', 'all', 'p')[0].min, 30);
  assert.equal(average(rowsFor([game], 'LAL', '1', 'p'), 'min'), null);
});

test('derived counts and unavailable reasons reach quarter rows and averages', () => {
  const checked = structuredClone(game);
  checked.sides.LAL.periods[0] = { pts: 25, ast: 6, oreb: 2, dreb: 8, blk: 0 };
  checked.sides.LAL.quarterValidation = { status: 'checked', unavailable: {} };
  const partial = structuredClone(checked);
  partial.id = '2';
  partial.sides.LAL.periods[0].ast = null;
  partial.sides.LAL.quarterValidation = { status: 'partial', unavailable: { ast: 'Totals do not match.' } };
  const rows = rowsFor([checked, partial], 'LAL', '1');
  assert.equal(rows[0].ast, 6);
  assert.equal(rows[1].quarterValidation.unavailable.ast, 'Totals do not match.');
  assert.equal(average(rows, 'ast'), null);
  assert.equal(average(rows, 'blk'), 0);
});
