import { DatabaseSync } from 'node:sqlite';
import { normalizeGame } from './normalize.js';

// Durable storage shared by the app and the standalone fixture prototype.
// Provider IDs are scoped by provider; no four-team catalog limits are imposed.
export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS games (
      provider TEXT NOT NULL, id TEXT NOT NULL, date_utc TEXT NOT NULL,
      source_url TEXT NOT NULL, fetched_at TEXT NOT NULL, imported_at TEXT NOT NULL,
      raw_json TEXT NOT NULL, PRIMARY KEY(provider, id)
    );
    CREATE TABLE IF NOT EXISTS teams (
      provider TEXT NOT NULL, id TEXT NOT NULL, abbreviation TEXT NOT NULL,
      PRIMARY KEY(provider, id)
    );
    CREATE TABLE IF NOT EXISTS players (
      provider TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
      PRIMARY KEY(provider, id)
    );
    CREATE TABLE IF NOT EXISTS team_games (
      provider TEXT NOT NULL, game_id TEXT NOT NULL, team_id TEXT NOT NULL,
      record_json TEXT NOT NULL, PRIMARY KEY(provider, game_id, team_id),
      FOREIGN KEY(provider, game_id) REFERENCES games(provider, id),
      FOREIGN KEY(provider, team_id) REFERENCES teams(provider, id)
    );
    CREATE TABLE IF NOT EXISTS player_games (
      provider TEXT NOT NULL, game_id TEXT NOT NULL, player_id TEXT NOT NULL,
      team_id TEXT NOT NULL, played INTEGER NOT NULL CHECK(played IN (0,1)),
      record_json TEXT NOT NULL, PRIMARY KEY(provider, game_id, player_id),
      FOREIGN KEY(provider, game_id) REFERENCES games(provider, id),
      FOREIGN KEY(provider, player_id) REFERENCES players(provider, id),
      FOREIGN KEY(provider, team_id) REFERENCES teams(provider, id)
    );
    CREATE INDEX IF NOT EXISTS team_lookup ON team_games(provider, team_id, game_id);
    CREATE INDEX IF NOT EXISTS player_lookup ON player_games(provider, player_id, played, game_id);
    CREATE TABLE IF NOT EXISTS schedules (
      team_id TEXT NOT NULL, season INTEGER NOT NULL, fetched_at TEXT NOT NULL,
      data_json TEXT NOT NULL, PRIMARY KEY(team_id, season)
    );
  `);

  // Validate before replacing a game. The transaction also restores every old
  // row if an insert fails halfway through (for example, a duplicate player ID).
  function importGame(payload, { fetchedAt = payload.capturedAt } = {}) {
    if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('A valid source download timestamp is required.');
    const game = normalizeGame(payload);
    if (!/^\d+$/.test(game.id)) throw new Error('A valid ESPN game ID is required.');
    const teams = payload.header.competitions[0].competitors;
    if (new Set(teams.map(t => t.team.id)).size !== 2) throw new Error('Two distinct teams are required.');
    for (const team of teams) {
      if (!/^\d+$/.test(String(team.team.id))) throw new Error('Invalid team ID.');
    }
    for (const side of Object.values(game.sides)) {
      for (const p of side.players) {
        if (!/^\d+$/.test(p.id) || !p.name) throw new Error('Invalid player identity.');
      }
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO games VALUES ('espn',?,?,?,?,?,?)
        ON CONFLICT(provider,id) DO UPDATE SET date_utc=excluded.date_utc,
        source_url=excluded.source_url,fetched_at=excluded.fetched_at,
        imported_at=excluded.imported_at,raw_json=excluded.raw_json`).run(
        game.id, game.dateUTC,
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.id}`,
        fetchedAt, new Date().toISOString(), JSON.stringify(payload));
      db.prepare("DELETE FROM player_games WHERE provider='espn' AND game_id=?").run(game.id);
      db.prepare("DELETE FROM team_games WHERE provider='espn' AND game_id=?").run(game.id);
      for (const team of teams) {
        // Home/away links the provider identity to the normalized side without
        // depending on ESPN's alternate abbreviation spellings.
        const side = Object.values(game.sides).find(s => s.homeAway === team.homeAway);
        if (!side) throw new Error('Unmatched team side.');
        const id = String(team.team.id);
        db.prepare(`INSERT INTO teams VALUES ('espn',?,?) ON CONFLICT(provider,id)
          DO UPDATE SET abbreviation=excluded.abbreviation`).run(id, team.team.abbreviation);
        db.prepare("INSERT INTO team_games VALUES ('espn',?,?,?)").run(game.id, id, JSON.stringify({ ...side, players: undefined }));
        for (const player of side.players) {
          db.prepare(`INSERT INTO players VALUES ('espn',?,?) ON CONFLICT(provider,id)
            DO UPDATE SET name=excluded.name`).run(player.id, player.name);
          db.prepare("INSERT INTO player_games VALUES ('espn',?,?,?,?,?)").run(game.id, player.id, id, Number(player.played), JSON.stringify(player));
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return game.id;
  }

  // Return dated records in most-recent-first order. Player appearances exclude
  // DNP rows, while the database still preserves every supplied player record.
  function lookup(kind, id, provider = 'espn') {
    const table = kind === 'team' ? 'team_games' : 'player_games';
    const column = kind === 'team' ? 'team_id' : 'player_id';
    return db.prepare(`SELECT g.id,g.date_utc,g.source_url,g.fetched_at,r.team_id,r.record_json
      FROM ${table} r JOIN games g ON g.provider=r.provider AND g.id=r.game_id
      WHERE r.provider=? AND r.${column}=? ${kind === 'player' ? 'AND r.played=1' : ''}
      ORDER BY g.date_utc DESC,g.id DESC`).all(provider, String(id))
      .map(({ record_json, ...row }) => ({ ...row, record: JSON.parse(record_json) }));
  }
  return {
    importGame,
    hasGame: (id, provider = 'espn') => Boolean(db.prepare('SELECT 1 FROM games WHERE provider=? AND id=?').get(provider, String(id))),
    // Schedule snapshots retain discovery information across app restarts.
    saveSchedule: (team, season, record) => db.prepare(`INSERT INTO schedules VALUES (?,?,?,?)
      ON CONFLICT(team_id,season) DO UPDATE SET fetched_at=excluded.fetched_at,data_json=excluded.data_json`)
      .run(String(team), season, record.fetchedAt, JSON.stringify({ classificationVersion: record.classificationVersion ?? 0, events: record.data })),
    getSchedule: (team, season) => {
      const row = db.prepare('SELECT * FROM schedules WHERE team_id=? AND season=?').get(String(team), season);
      if (!row) return null;
      const saved = JSON.parse(row.data_json);
      return { fetchedAt: row.fetched_at, data: Array.isArray(saved) ? saved : saved.events,
        classificationVersion: Array.isArray(saved) ? 0 : saved.classificationVersion };
    },
    teamGames: (id, provider) => lookup('team', id, provider),
    playerAppearances: (id, provider) => lookup('player', id, provider),
    // Raw responses preserve undisplayed fields for future normalization changes.
    getGame: (id, provider = 'espn') => {
      const row = db.prepare('SELECT * FROM games WHERE provider=? AND id=?').get(provider, String(id));
      return row ? { ...row, raw: JSON.parse(row.raw_json), raw_json: undefined } : null;
    },
    counts: () => Object.fromEntries(['games', 'teams', 'players', 'team_games', 'player_games'].map(t => [t, db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n])),
    close: () => db.close(),
  };
}
