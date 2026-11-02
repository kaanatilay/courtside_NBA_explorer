# Saved data in the existing interface

Completed November 2, 2026. Node 24.13.0 tested; Node 22.13+ required. No new
package, subscription, bulk import, league-selection expansion or player-quarter
implementation was introduced.

## Behavior

The Vite API opens `.local-data/games.sqlite` lazily when data is first requested.
This is separate from the fixture-only prototype database. Existing temporary
caches are not automatically migrated. The first selection downloads its
schedule snapshots and missing games, then saves them. Later views reuse those
records without an age-based expiry. Refresh explicitly downloads schedules and
the games scanned for the selected team/player samples, including DNPs inspected
to find appearances. It does not refresh the whole historical database.

Games are keyed by provider/game ID; schedules by team/season. Replacement is
transactional and keeps no revision copies. Existing players/teams may remain
as identity records after a correction, but game records do not accumulate per
refresh. SQLite file size may grow when allocating pages even if row counts do
not grow; file size alone is not a duplicate test.

Provider responses are normalized and saved before reporting download success.
An invalid game or failed storage operation preserves its previous transaction.
Failed downloads return existing saved records with explicit API warnings.
Missing records still fail a complete sample rather than silently omitting a
game. For a failed refresh, the browser can retain the previous exact selection
with a warning. A first-time selection without sufficient saved data shows an
error. No different selection is substituted.

The UI shows the oldest download timestamp across the schedule and scanned game
records, indicates when saved records were used, and displays refresh warnings.
This is not a per-game freshness guarantee. One refreshed game shared by two
teams may be read from storage in the second sample and count as saved reuse.
Filters and newly opened player details do not force downloads merely because
Refresh was pressed earlier. Defender tracking retains its separate archive
cache and retry behavior; it is not stored in this database.

## Verification

All 25 offline tests passed outside the Windows sandbox, including a new
service/provider/SQLite integration test. It verifies no-network reuse after
reopening, explicit refreshed corrections, stable row counts, missing-record
failure, invalid-response preservation, timestamps, and warnings for failed
schedule/game refreshes. The production build passed. Browser interactions and
live-provider freshness were not independently exercised for this milestone.

## Review through the interface

1. Start `npm run dev` with Node 24. Select BOS and NYK, 2024–25,
   Against each other, Last 3. Wait for downloads; note the oldest timestamp.
2. Stop the server with Ctrl+C, restart, and reopen the same selection. Results
   should show saved-record reuse with the same download timestamp.
3. Press Refresh data. The selected records are updated; it does not add a new
   copy of each game. If the provider succeeds, download timestamps advance.
4. Open Jayson Tatum's details. Check the player log and its saved-data status.
5. After loading a selection successfully, temporarily disconnect the network
   and press Refresh. Allow time for request timeouts. A warning should identify
   the unsuccessful refresh while saved results remain. Reconnect afterward.

The database is local, not a backup. Do not delete it to refresh data. Shared
multi-machine use of the live OneDrive database is not tested; use one running
instance. Schema migrations, correction history, request scheduling, broad
performance benchmarks and backup tooling remain future work.
