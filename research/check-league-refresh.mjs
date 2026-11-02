import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';

// Explicit manual verification: starts a temporary loopback server and runs one
// real current-season cycle into the normal local collection. No fixtures are
// substituted. It closes only the server created here, not a user's terminal.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const response = await fetch(`${base}/api/refresh`, { method: 'POST' });
  if (response.status !== 202) throw new Error(`Start returned ${response.status}`);
  let status = await response.json();
  const second = await (await fetch(`${base}/api/refresh`, { method: 'POST' })).json();
  if (second.startedAt !== status.startedAt) throw new Error('Concurrent click started another cycle');
  while (status.state === 'running') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    status = await (await fetch(`${base}/api/refresh`)).json();
  }
  await writeFile(new URL('./league-refresh-check.json', import.meta.url), JSON.stringify(status, null, 2));
  console.log(JSON.stringify(status, null, 2));
} finally { await server.close(); }
