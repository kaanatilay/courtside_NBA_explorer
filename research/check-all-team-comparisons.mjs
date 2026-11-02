import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { teams, currentSeason } from '../src/catalog.js';

// Exercise the real HTTP interface API against the saved league collection.
// Missing records follow normal on-demand behavior; no refresh cycle is started.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
const results = [];
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (let i = 0; i < teams.length; i++) {
    const left = teams[i].id, right = teams[(i + 1) % teams.length].id;
    const query = new URLSearchParams({ left, right, season: String(currentSeason()), limit: '3', mode: 'recent' });
    const response = await fetch(`${base}/api/comparison?${query}`);
    const body = await response.json();
    if (!response.ok) throw new Error(`${left}/${right}: ${body.error}`);
    const player = body.games.flatMap(g => g.sides[left]?.players || []).find(p => p.played);
    if (!player) throw new Error(`No participating player for ${left}`);
    query.set('player', player.id);
    const detail = await fetch(`${base}/api/player?${query}`);
    const playerBody = await detail.json();
    if (!detail.ok) throw new Error(`${left} player: ${playerBody.error}`);
    results.push({ left, right, teamGames: body.samples[left].length, player: player.name,
      appearances: playerBody.games.length, saved: body.savedRecordsUsed, warnings: body.warnings });
  }
  await writeFile(new URL('./all-team-comparison-check.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  console.log(`PASS: ${results.length} team comparisons and ${results.length} player detail requests through real HTTP API.`);
} finally { await server.close(); }
