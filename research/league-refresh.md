# League-wide manual update

Implemented November 2, 2026. This supersedes the selection-only Refresh button
in saved-data-integration.md. Playoffs/play-in are outside the current implementation scope.

## Cycle and interface

`POST /api/refresh` starts or joins the single active cycle in this server
process. `GET /api/refresh` reads its status. Cross-origin browser POSTs are
rejected. Cycle state/progress remains in memory, so a browser reload can
reconnect while the server is running; restarting the server loses the progress
summary and interrupts work. Successfully committed games remain saved and the
next cycle discovers missing work again. This is not an unattended worker or a
durable job queue. Use one running server instance.

The cycle discovers 30 ESPN team identities, retrieves current regular-season
schedules with existing event classification, and deduplicates games shared by
two teams. It downloads every discovered missing completed game regardless of
age. Saved games whose start timestamp is within seven elapsed days of cycle
start are re-downloaded for corrections; older saved games are skipped. This
does not detect corrections to older games. The first run later in a season
can involve substantially more downloads than the first run measured below.

Two workers bound simultaneous requests. A failure is reported and other items
continue. A failed schedule can supply a validated saved snapshot, but the cycle
is still marked incomplete. Missing games and failed refreshes are counted as
failures, not successful additions/updates. Transactions preserve good saved
records. `updated` means successfully re-downloaded/replaced, not necessarily
that statistics changed. Expected game ID, participant IDs and start timestamp
are checked before replacement. Conflicting schedule identities are excluded
from work and reported. No automatic retries occur inside a cycle.

The existing comparison remains selectable during a cycle. After completion,
the displayed comparison/player requests read the updated saved data. Team
selection still offers four teams; the background collection covers all 30.
Historical selections may fetch missing records on demand but are not refreshed
by this button. Defender tracking keeps its separate Retry tracking control.
Cup finals and unfinished games remain excluded from the cycle.

## Verification

- All 31 offline tests passed; production build passed.
- Cycle tests cover shared game IDs, concurrent starts, exact seven-day boundary,
  older missing versus older saved games, partial failure, directory failure,
  snapshots safe from caller mutation, and two real-fixture cycles with stable
  game/team/player row counts.
- A real temporary loopback Vite server exercised HTTP POST/GET and a duplicate
  start, then completed the cycle into `.local-data/games.sqlite`. It discovered
  92 completed games from 30 schedules, added 82, re-downloaded 8 and reused 2
  older saved games; zero failures. The measured cycle ran about 15 seconds.
  This is one observation, not a performance guarantee. Evidence is retained in
  `league-refresh-check.json`; `check-league-refresh.mjs` repeats a real update,
  not a read-only check, so do not run it just to inspect the saved result.
- Visual browser interaction/progress rendering was not automated in this
  milestone. The API, actual download/storage path and frontend compilation
  were verified separately.

## Review

Restart `npm run dev` if it was running before the update. The League data
update panel is visible regardless of selected season. Press Refresh league
data: schedules then games should show progress, followed by counts/failures.
The same cycle status reconnects after a browser reload while work is running.
Changing filters does not launch another cycle. On a second cycle, already
collected games should report zero additions unless ESPN supplies newly
completed records; recent games are still re-downloaded. Older saved records
are reused. Disconnecting the network produces explicit failures, retaining
saved data; reconnect and run again to retry.
