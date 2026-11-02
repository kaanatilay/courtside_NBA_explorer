import { currentSeason } from '../src/catalog.js';

// Two workers bound provider pressure; one cycle per process prevents duplicate
// button clicks or browser tabs from launching overlapping league downloads.
async function workers(items, action) {
  let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < items.length) await action(items[next++]);
  }));
}

export function createRefreshService(provider, store, { now = () => new Date() } = {}) {
  let status = { state: 'idle' };
  let running;
  const snapshot = () => structuredClone(status);
  async function run() {
    try {
      const teams = await provider.leagueTeams();
      status.teamsTotal = teams.length;
      status.phase = 'schedules';
      const events = new Map();
      const conflicting = new Set();
      await workers(teams, async team => {
        try {
          const schedule = await provider.schedule(team.id, status.season, true);
          if (schedule.warning) status.failures.push({ kind: 'schedule', id: team.id, message: schedule.warning });
          // A failed schedule refresh can still supply a classified saved
          // schedule; its warning keeps the cycle from claiming full success.
          for (const event of schedule.data) {
            if (event.seasonYear !== status.season || event.seasonType !== 2 || event.competitionClass !== 'regular-season') throw new Error('Unverified regular-season schedule event.');
            if (conflicting.has(event.id)) continue;
            if (events.has(event.id)) {
              const previous = events.get(event.id);
              if (previous.dateUTC !== event.dateUTC || JSON.stringify([...previous.teamIds].sort()) !== JSON.stringify([...event.teamIds].sort())) {
                events.delete(event.id); conflicting.add(event.id);
                throw new Error(`Conflicting schedule identity for game ${event.id}.`);
              }
            }
            events.set(event.id, event);
          }
        } catch (error) { status.failures.push({ kind: 'schedule', id: team.id, message: error.message }); }
        finally { status.teamsChecked++; }
      });
      status.phase = 'games';
      const cutoff = Date.parse(status.startedAt) - 7 * 24 * 60 * 60_000;
      const work = [];
      for (const event of events.values()) {
        const exists = store.hasGame(event.id);
        if (!exists || Date.parse(event.dateUTC) >= cutoff) work.push({ event, exists });
        else status.olderGamesReused++;
      }
      status.gamesTotal = work.length;
      status.gamesDiscovered = events.size;
      await workers(work, async ({ event, exists }) => {
        try {
          const record = await provider.game(event.id, true, event);
          if (record.warning) throw new Error(record.warning);
          if (exists) status.updated++;
          else status.added++;
        } catch (error) { status.failures.push({ kind: 'game', id: event.id, message: error.message }); }
        finally { status.gamesChecked++; }
      });
      status.state = status.failures.length ? 'partial' : 'complete';
    } catch (error) {
      status.failures.push({ kind: 'cycle', message: error.message });
      status.state = 'failed';
    } finally { status.finishedAt = now().toISOString(); status.phase = 'finished'; }
  }
  return {
    status: snapshot,
    start() {
      if (status.state === 'running') return snapshot();
      const date = now();
      status = { state: 'running', phase: 'directory', season: currentSeason(date), startedAt: date.toISOString(),
        correctionDays: 7, teamsTotal: 30, teamsChecked: 0, gamesTotal: 0, gamesChecked: 0,
        gamesDiscovered: 0, olderGamesReused: 0, added: 0, updated: 0, failures: [] };
      running = run();
      return snapshot();
    },
    // Tests/shutdown can await the existing cycle without starting another one.
    wait: () => running,
  };
}
