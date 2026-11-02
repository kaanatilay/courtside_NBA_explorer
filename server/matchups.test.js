import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { normalizeMatchups, identifyGame, parseCsv, createMatchupService } from './matchups.js';
import { parseMatchupQuery } from './api.js';

const historical = JSON.parse(await readFile(new URL('./fixtures/nba-matchups-0022400061.json', import.meta.url)));
const empty = JSON.parse(await readFile(new URL('./fixtures/nba-matchups-0022600023.json', import.meta.url)));
const scheduleCsv = 'game_id,season,season_type,game_date,home_team_id,home_team_abbreviation,home_pts,away_team_id,away_team_abbreviation,away_pts\n0022400061,2025,regular-season,2024-10-22,1610612738,BOS,132,1610612752,NYK,109\n';
const crosswalkCsv = 'espn_athlete_id,nba_player_id,match_confidence\n4065648,1628369,1.0\n';
const nbaGame = parseCsv(scheduleCsv)[0];
const player = { id: '4065648', name: 'Jayson Tatum', played: true };
const context = { nbaGame, player, team: 'BOS', crosswalk: parseCsv(crosswalkCsv) };
const game = { id: '401704627', date: '2024-10-22', sides: {
  BOS: { homeAway: 'home', stats: { pts: 132 }, players: [player] },
  NYK: { homeAway: 'away', stats: { pts: 109 }, players: [] },
} };

// These expected values were read directly from the public NBA JSON, including
// another player's matchup and a nonzero defender block to check direction.
test('historical Tatum matchups use offense->defense and precise time ranking', () => {
  const result = normalizeMatchups(historical, context);
  assert.equal(result.available, true);
  assert.deepEqual(result.primaryIds, ['1628969']);
  assert.deepEqual(result.defenders[0], { id: '1628969', name: 'Mikal Bridges', seconds: 361.6, time: '6:02', pts: 10, ast: 4, turnovers: 0, blocks: 0, fgm: 4, fga: 4, threeMade: 2, threeAttempted: 2 });
  assert.equal(result.defenders.find(row => row.name === 'Jericho Sims').blocks, 1);
  assert.equal(result.defenders.find(row => row.name === 'OG Anunoby').turnovers, 1);
});

test('missing archive tracking, wrong games, conflicting IDs, names and defenders stay unavailable', () => {
  const emptyGame = { game_id: '0022600023', home_team_id: '1610612744', away_team_id: '1610612747' };
  assert.equal(normalizeMatchups(empty, { ...context, nbaGame: emptyGame }).available, false);
  assert.equal(normalizeMatchups(historical, { ...context, nbaGame: emptyGame }).available, false);
  assert.equal(normalizeMatchups(historical, { ...context, player: { ...player, name: 'Wrong Person' } }).available, false);
  assert.equal(normalizeMatchups(historical, { ...context, crosswalk: [...context.crosswalk, { espn_athlete_id: player.id, nba_player_id: '99', match_confidence: '1' }] }).available, false);
  const bad = structuredClone(historical);
  bad.boxScoreMatchups.homeTeam.players.find(row => row.personId === 1628369).matchups[0].personId = 999;
  assert.equal(normalizeMatchups(bad, context).available, false);
});

test('missing stats remain null, and tied primary times are explicit', () => {
  const changed = structuredClone(historical);
  const matchups = changed.boxScoreMatchups.homeTeam.players.find(row => row.personId === 1628369).matchups;
  matchups[0].statistics.matchupMinutesSort = 361.6;
  delete matchups[0].statistics.playerPoints;
  const result = normalizeMatchups(changed, context);
  assert.equal(result.primaryIds.length, 2);
  assert.equal(result.defenders.find(row => row.name === 'OG Anunoby').pts, null);
});

test('game mapping rejects wrong dates, home/away, scores, season and ambiguous schedule rows', () => {
  assert.equal(identifyGame(game, [nbaGame], 2025).game_id, '0022400061');
  for (const patch of [{ game_date: '2024-10-23' }, { home_team_abbreviation: 'NYK' }, { home_pts: '130' }, { season: '2026' }]) assert.equal(identifyGame(game, [{ ...nbaGame, ...patch }], 2025), null);
  assert.equal(identifyGame(game, [nbaGame, nbaGame], 2025), null);
  assert.equal(parseCsv('id,name\n1,"Last, First"\n')[0].name, 'Last, First');
  assert.throws(() => parseMatchupQuery(new URLSearchParams('team=BOS&game=../x&player=1&season=2025')));
});

test('service downloads correct sources, caches, refreshes and rejects nonparticipants', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nba-matchups-'));
  let calls = 0;
  const fetcher = async url => {
    calls++;
    if (url.endsWith('.csv.gz')) return new Response(gzipSync(scheduleCsv));
    if (url.endsWith('.csv')) return new Response(crosswalkCsv);
    assert.ok(url.endsWith('/2025/0022400061.json'));
    return Response.json(historical);
  };
  try {
    const service = createMatchupService({ game: async () => ({ data: game }) }, { fetcher, directory });
    const query = { gameId: game.id, playerId: player.id, team: 'BOS', season: 2025, refresh: false };
    assert.equal((await service(query)).available, true);
    assert.equal((await service(query)).available, true);
    assert.equal(calls, 3);
    await service({ ...query, refresh: true });
    assert.equal(calls, 6);
    await assert.rejects(service({ ...query, playerId: '99' }), /did not appear/);
    const missing = createMatchupService({ game: async () => ({ data: game }) }, { fetcher: async () => new Response('', { status: 404 }), directory });
    assert.equal((await missing({ ...query, refresh: true })).available, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
