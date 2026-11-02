import { mkdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openStore } from '../server/store.js';

// Import saved fixtures only. Re-running this demo updates the same three games.
const directory = new URL('../.local-data/', import.meta.url);
await mkdir(directory, { recursive: true });
const filename = new URL('prototype.sqlite', directory);
const store = openStore(fileURLToPath(filename));
try {
  for (const id of ['401704627', '401909285', '401703371']) {
    const payload = JSON.parse(await readFile(new URL(`../server/fixtures/espn-${id}.json`, import.meta.url), 'utf8'));
    store.importGame(payload);
  }
  console.log(JSON.stringify({ counts: store.counts(), tatum: store.playerAppearances('4065648'), detroit: store.teamGames('8') }, null, 2));
} finally {
  store.close();
}
console.log(`SQLite file size: ${(await stat(filename)).size} bytes (three-game sample, including raw responses).`);
