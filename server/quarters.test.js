import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeGame } from './normalize.js';

const ids = ['401704627', '401909285', '401909880', '401703371'];
const fixtures = Object.fromEntries(await Promise.all(ids.map(async id => [id,
  JSON.parse(await readFile(new URL(`./fixtures/espn-${id}.json`, import.meta.url), 'utf8')),
])));
const manual = JSON.parse(await readFile(new URL('./fixtures/manual-quarter-checks.json', import.meta.url), 'utf8'));
const copy = id => structuredClone(fixtures[id]);
const countingKeys = ['ast', 'oreb', 'dreb', 'blk'];

// These expected period values were tallied by reviewing event descriptions,
// with the actual event IDs recorded for another reviewer to inspect.
test('six manually tallied team periods match all five metrics', () => {
  for (const check of manual.checks) {
    const side = normalizeGame(fixtures[check.gameId]).sides[check.team];
    assert.deepEqual(Object.fromEntries(Object.keys(check.expected).map(key => [key, side.periods[check.period - 1][key]])), check.expected, `${check.gameId} ${check.team} P${check.period}`);
    const plays = fixtures[check.gameId].plays;
    for (const key of ['assistEventSuffixes', 'offensiveReboundSuffixes', 'defensiveReboundSuffixes', 'blockSuffixes']) {
      assert.ok(check[key].every(suffix => plays.some(play => play.id === `${check.gameId}${suffix}` && play.period.number === check.period)));
    }
    // Check the reviewed scoring list against its own point values as well.
    const points = check.scoringEventSuffixes.reduce((sum, suffix) => sum + plays.find(play => play.id === `${check.gameId}${suffix}`).scoreValue, 0);
    assert.equal(points, check.expected.pts);
  }
});

test('all four complete feeds reconcile every metric, including overtime', () => {
  for (const id of ids) for (const side of Object.values(normalizeGame(fixtures[id]).sides)) {
    // New fields have independent checks; the original five remain validated.
    assert(countingKeys.every(key => !side.quarterValidation.unavailable[key]), id);
    for (const key of ['pts', ...countingKeys]) assert.equal(side.periods.reduce((sum, row) => sum + row[key], 0), side.stats[key], `${id} ${key}`);
  }
  const overtime = normalizeGame(fixtures['401703371']).sides.DET;
  assert.equal(overtime.periods.length, 5);
  assert.equal(overtime.periods[3].pts, 20);
  assert.equal(overtime.periods[4].pts, 12);
  assert.equal(overtime.stats.pts, 123);
});

test('late correction uses its explicit period, not arrival after Q4 starts', () => {
  const payload = copy('401909880');
  const corrected = payload.plays.find(play => play.id === '401909880558');
  assert.equal(corrected.period.number, 3);
  assert.ok(payload.plays.some(play => play.period.number === 4 && Number(play.sequenceNumber) < Number(corrected.sequenceNumber)));
  const game = normalizeGame(payload);
  assert.equal(game.sides.POR.periods[2].pts, 34);
  assert.equal(game.sides.POR.periods[3].pts, 34);
  payload.plays.reverse();
  assert.deepEqual(normalizeGame(payload), game);
});

test('identical duplicates are counted once; conflicting duplicates are withheld', () => {
  const payload = copy('401704627');
  const play = payload.plays.find(play => play.scoringPlay);
  payload.plays.push(structuredClone(play));
  assert.equal(normalizeGame(payload).sides.BOS.quarterValidation.duplicatesRemoved, 1);
  assert.equal(normalizeGame(payload).sides.BOS.periods[0].ast, 11);
  payload.plays.at(-1).period.number = 2;
  const side = normalizeGame(payload).sides.BOS;
  assert.equal(side.periods[0].ast, null);
  assert.equal(side.periods[0].pts, 43);
  assert.match(side.quarterValidation.unavailable.ast, /conflicting/);
});

test('wrong scoring period fails even if full-game totals would still match', () => {
  const payload = copy('401704627');
  payload.plays.find(play => play.scoringPlay).period.number = 2;
  const side = normalizeGame(payload).sides.BOS;
  assert.equal(side.periods[0].ast, null);
  assert.match(side.quarterValidation.unavailable.ast, /period scores/);
});

test('one missing rebound withholds that metric without hiding other counts', () => {
  const payload = copy('401704627');
  payload.plays = payload.plays.filter(play => play.id !== '40170462721');
  const game = normalizeGame(payload);
  assert.equal(game.sides.BOS.periods[0].oreb, null);
  assert.equal(game.sides.BOS.periods[0].ast, 11);
  assert.equal(game.sides.NYK.periods[0].oreb, 1);
  assert.equal(game.sides.BOS.quarterValidation.status, 'partial');
  assert.match(game.sides.BOS.quarterValidation.unavailable.oreb, /full-game box score/);
});

test('ambiguous block attribution does not credit the shooter team', () => {
  const payload = copy('401909285');
  payload.plays.find(play => play.id === '40190928594').participants.pop();
  const game = normalizeGame(payload);
  assert.equal(game.sides.LAL.periods[0].blk, null);
  assert.equal(game.sides.GSW.periods[0].blk, null);
  assert.equal(game.sides.LAL.periods[0].ast, 10);
});

test('missing feed/endings, invalid clocks/participants and incomplete scoring fail safely', () => {
  const missing = copy('401704627'); delete missing.plays;
  const ending = copy('401704627'); ending.plays = ending.plays.filter(play => !(play.type.text === 'End Period' && play.period.number === 2));
  const clock = copy('401704627'); clock.plays[0].clock.displayValue = '99:00';
  const scoring = copy('401704627'); scoring.plays = scoring.plays.filter(play => play.id !== '4017046277');
  const participants = copy('401704627'); participants.plays[0].participants = {};
  for (const payload of [missing, ending, clock, scoring, participants]) {
    const game = normalizeGame(payload);
    for (const side of Object.values(game.sides)) {
      assert.equal(side.quarterValidation.status, 'unavailable');
      assert.ok(side.periods.every(row => countingKeys.every(key => row[key] === null)));
      assert.ok(side.stats.pts > 0);
      assert.ok(side.periods[0].pts > 0);
    }
  }
});

test('missing full-game metric is unavailable, not assumed zero', () => {
  const payload = copy('401704627');
  payload.boxscore.teams[0].statistics = payload.boxscore.teams[0].statistics.filter(stat => stat.name !== 'assists');
  const side = normalizeGame(payload).sides.NYK;
  assert.equal(side.periods[0].ast, null);
  assert.equal(side.periods[0].dreb, 6);
});
