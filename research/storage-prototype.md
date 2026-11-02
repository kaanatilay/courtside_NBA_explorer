# Local storage prototype

Completed November 2, 2026. This standalone prototype uses saved fixtures only;
it is not connected to the UI, live fetching, or the existing expiring cache.

## Run and inspect

Use Node 24 (tested here: 24.13.0). The prototype uses built-in `node:sqlite`,
which this Node version still marks experimental. No dependency was installed.
The existing app can still run on its previously documented Node versions, but
the new storage module and full test suite require a Node version with this
SQLite API (22.13+ without the experimental SQLite flag; Node 24 recommended).

```powershell
node research/storage-demo.mjs
node --test server/store.test.js
```

The demo creates `.local-data/prototype.sqlite`, imports three saved games,
prints row counts plus Tatum and Detroit lookups, then closes the database.
Run it again: counts should remain 3 games, 6 teams, 79 distinct players,
6 team-game records and 80 player-game records. Player records include supplied
DNP rows; appearance queries exclude them. Detroit's record has five periods.
The original fixture capture time is retained; today's import time is stored
separately. No fresh download is claimed. `.local-data/` is ignored by Git.

## How the pieces fit

`server/store.js` opens SQLite and provides importGame, getGame, teamGames,
playerAppearances, counts and close. Games are unique by provider and provider
game ID. Team/player identities are stored separately from per-game records;
the same game is shared by every player lookup. Provider IDs are not mixed
with NBA IDs. There is no four-team restriction in this module.

Each game stores a single original JSON response for future field extraction.
Team/player rows store the current normalized metrics as JSON, while indexed
identity columns support lookups. Raw and normalized data intentionally overlap;
this avoids losing undisplayed source fields and is not duplicate game imports.
Derived team quarter records retain their validation explanation. No player
quarter totals or reconstructed player minutes are introduced.

An update replaces all per-game records in one transaction. Either every write
succeeds, or every write is rolled back. Missing normalized values stay null.
Basic identity/completion checks and existing normalization run before writing;
this is not an exhaustive upstream statistical-quality validator. A valid
replacement may introduce missing metrics reported by its source. Correction
history and automatic rejection of older download timestamps are not implemented.

## Verification and size

- All 24 project tests passed outside the Windows sandbox. Inside it, the
  pre-existing cache rename test failed with EPERM; the new store test passed.
- Production build passed.
- Store test covers importing all supplied player rows, importing twice,
  reopening the database, multiple player lookups, outside-catalog teams,
  overtime, a valid correction, pre-write invalid input, and rollback after a
  duplicate-player insertion fails midway through replacement.
- Three-game SQLite file: 638,976 bytes, about 624 KiB after a repeat import,
  including raw responses with play-by-play (first import: 634,880 bytes).
  SQLite allocates storage in pages, so size can change without more games.
  Simple scaling is about 250 MiB per 1,230 games, but this
  tiny sample is not a capacity forecast: event lengths, overtime, indexes and
  future tracking data vary. No bulk import or performance benchmark was run.

This file persists until removed, but is not a backup. The workspace is in
OneDrive; simultaneous use of a live SQLite file from multiple synced machines
has not been tested. Before UI integration, agree the runtime requirement,
database location, refresh rules, season/sample filters and schema migration
strategy. Public API integration, league expansion in the UI, subscriptions,
bulk downloads and a database browser are outside this milestone.
