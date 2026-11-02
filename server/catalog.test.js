import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { teams, currentSeason } from '../src/catalog.js';
import { parseQuery, parseMatchupQuery } from './api.js';
import { normalizeGame } from './normalize.js';

// Compare the selectable identities with the actual league inventory retained
// in the audit, especially ESPN's GS/NY/NO/SA/UTAH/WSH spelling differences.
test('all 30 selectable teams match saved ESPN identities and pass API validation', async () => {
  const audit = JSON.parse(await readFile(new URL('../research/coverage-audit-results.json', import.meta.url), 'utf8'));
  const inventory = audit.schedules.filter(s => s.season === 2027 && s.type === 2).map(s => s.team);
  const aliases = { GS: 'GSW', NY: 'NYK', NO: 'NOP', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
  assert.equal(teams.length, 30);
  assert.equal(new Set(teams.map(t => t.id)).size, 30);
  assert.equal(new Set(teams.map(t => t.providerId)).size, 30);
  for (const team of teams) {
    const provider = inventory.find(t => t.id === team.providerId);
    assert.equal(aliases[provider.name] || provider.name, team.id);
    const right = teams.find(t => t.id !== team.id).id;
    const params = new URLSearchParams({ left: team.id, right, season: String(currentSeason()), limit: '3', mode: 'recent' });
    assert.equal(parseQuery(params).left.providerId, team.providerId);
    assert.equal(parseMatchupQuery(new URLSearchParams({ team: team.id, game: '123', player: '456', season: String(currentSeason()) })).team, team.id);
    params.set('right', team.id);
    assert.throws(() => parseQuery(params), /Invalid/);
  }
});

test('Washington provider abbreviation maps to the selectable team identity', async () => {
  const p = JSON.parse(await readFile(new URL('./fixtures/espn-401704627.json', import.meta.url), 'utf8'));
  p.header.competitions[0].competitors[0].team.abbreviation = 'WSH';
  assert.ok(normalizeGame(p).sides.WAS);
});
