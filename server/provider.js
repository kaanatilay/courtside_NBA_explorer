import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalizeGame, normalizeSchedule } from './normalize.js';

const base = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const cacheDirectory = fileURLToPath(new URL('../.data-cache/', import.meta.url));
// Earlier cache versions lack quarters or use an earlier parser revision.
// Refetch instead of treating those normalized results as current calculations.
const CACHE_VERSION = 5;
const SCHEDULE_VERSION = 4;

// Save only normalized records used by the app, not unrelated articles/videos.
// Concurrent requests for a key share one fetch and one atomic cache write.
export function createProvider({ fetcher = fetch, directory = cacheDirectory, store = null } = {}) {
  const pending = new Map();
  async function cached(key, url, ttl, normalize, refresh, persistence = null) {
    const version = key.startsWith('schedule-') ? SCHEDULE_VERSION : CACHE_VERSION;
    const file = join(directory, `${key}.json`);
    const savedRecord = persistence?.read();
    if (savedRecord && !refresh) return { ...savedRecord, storage: 'saved' };
    if (!refresh && !persistence) {
      try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        if (saved.version === version && Date.now() - Date.parse(saved.fetchedAt) < ttl) return saved;
      } catch { /* Missing or damaged caches are re-fetched. */ }
    }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      try {
      let response;
      try { response = await fetcher(url, { signal: AbortSignal.timeout(15000) }); }
      catch { throw new Error('Could not reach ESPN within 15 seconds. Check your connection and retry.'); }
      if (!response.ok) throw new Error(`ESPN returned HTTP ${response.status}. Please retry later.`);
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error('ESPN returned an unreadable response. Please retry later.'); }
      const record = { version, fetchedAt: new Date().toISOString(), data: normalize(payload) };
      if (persistence) {
        persistence.write(payload, record);
        return { ...record, storage: 'downloaded' };
      }
      await mkdir(directory, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(record));
      await rename(temporary, file);
      return record;
      } catch (error) {
        // Never hide a failed refresh: return the prior record with an explicit
        // warning. Missing records still fail the whole sample rather than skip.
        if (savedRecord) return { ...savedRecord, storage: 'saved', warning: `${key}: refresh failed. ${error.message}` };
        throw error;
      }
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  return {
    // Discover the complete league independently of the smaller UI catalog.
    async leagueTeams() {
      const response = await fetcher(`${base}/teams?limit=100`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`ESPN team directory returned HTTP ${response.status}.`);
      const payload = await response.json();
      const teams = payload.sports?.[0]?.leagues?.[0]?.teams?.map(({ team }) => ({ id: String(team.id), name: team.abbreviation }));
      if (!teams || teams.length !== 30 || new Set(teams.map(t => t.id)).size !== 30 || teams.some(t => !/^\d+$/.test(t.id))) throw new Error('ESPN did not return 30 distinct NBA teams.');
      return teams;
    },
    schedule: (team, season, refresh = false) => cached(`schedule-${team}-${season}`, `${base}/teams/${team}/schedule?season=${season}&seasontype=2`, 15 * 60_000,
      payload => normalizeSchedule(payload, Date.now(), { season, type: 2 }), refresh, store && {
      // Legacy rows lack event classification and cannot be used as a fallback.
      // Fetch once to replace their schedule; all saved game records stay intact.
      read: () => { const row = store.getSchedule(team, season); return row?.classificationVersion === 1 ? row : null; },
      write: (_payload, record) => store.saveSchedule(team, season, { ...record, classificationVersion: 1 }),
    }),
    game: (id, refresh = false, expected = null) => cached(`game-${id}`, `${base}/summary?event=${id}`, 24 * 60 * 60_000, payload => {
      // Validate the discovery record before replacing a saved game's contents.
      if (String(payload.header?.id) !== String(id)) throw new Error('ESPN returned a different game.');
      if (expected) {
        const competition = payload.header?.competitions?.[0];
        const actualTeams = competition?.competitors?.map(t => String(t.team.id)).sort();
        if (JSON.stringify(actualTeams) !== JSON.stringify([...expected.teamIds].sort()) || Date.parse(competition?.date) !== Date.parse(expected.dateUTC)) throw new Error('ESPN schedule and game identity do not agree.');
      }
      return normalizeGame(payload);
    }, refresh, store && {
      read: () => { const row = store.getGame(id); return row ? { fetchedAt: row.fetched_at, data: normalizeGame(row.raw) } : null; },
      write: (payload, record) => {
        if (String(payload.header?.id) !== String(id)) throw new Error('ESPN returned a different game.');
        store.importGame(payload, { fetchedAt: record.fetchedAt });
      },
    }),
  };
}
