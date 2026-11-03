# Selectable full-game statistics — review

Implemented and interface-reviewed November 2, 2026. Milestone 1 in ROADMAP.md.
Expanded team-quarter work is also complete and reviewed; see
team-quarter-stats-review.md. The combined checkpoint is awaiting manual commit
and push; no custom-layout branch has been created.

## Data and calculation

Existing raw ESPN responses now normalize steals, free throws made/attempted,
three-pointers made/attempted and team/game lead changes. Saved games are
re-normalized when read, so these additions do not require downloading them
again. Legacy normalized file-cache version was bumped. SQLite game identities,
raw records, retrieval-cycle scope and duplicate prevention remain unchanged.

The browser's shared metric definitions drive the chooser, comparison values,
player details and game-log columns. The original five defaults are retained.
Selections are browser-local and optional if storage is blocked. Lead changes
is excluded from players; extra metrics are unavailable in quarter views until
the next validation milestone. Player minutes remain visible independently;
compact roster previews retain minutes, points and assists.

Makes/attempts are parsed together. Missing, negative, fractional or impossible
pairs stay null. Percentages use summed makes divided by summed attempts;
one game's 0/0 does not invalidate a sample with other valid attempts, but a
missing pair does. Entirely zero-attempt samples show unavailable. Counts use
per-game averages above and exact values in logs. Provider shooting percentage
rounding is not averaged. Historical leadChanges may be absent and stays null.

## Checks

All 36 offline tests passed, including saved-fixture expected values, malformed
shooting pairs, unequal-attempt weighting, zero/missing attempts, unknown saved
keys and player/quarter scope. The production build passed. A temporary real
API server returned three saved Denver games with all requested source counts;
combined FT% was 84.7222… and 3P% 43.2989… (UI rounds to 84.7% and 43.3%).
This verifies transport and calculations against ESPN-shaped data, not independent
provider accuracy. Visual interactions have not been automated in this milestone.

## Interface review

1. Restart/reload the app, select full game, and open Choose stats below filters.
2. Select steals, FT made/attempted/%, 3PT made/attempted/%, and lead changes.
   Check summary rows and horizontally scrollable game-log columns.
3. Reload: selection should remain. Restore default stats should return the
   original five. Browser storage is per browser, not shared between computers.
4. Open a player: selected player metrics should appear in details/logs, with
   lead changes disabled because it belongs to the game. Minutes remain present.
5. Switch to a team quarter: only selected original-five metrics should appear;
   added choices are marked Full game for now. Returning to full game restores
   their display without losing the saved selection.
6. Check any missing historical fields show an em dash, not zero. Check one
   displayed shooting percentage against combined makes/attempts in its rows.

The data map's project source and standalone copy were updated to reflect these
selectable full-game fields. Field-goal and total-rebound additions are future
candidates; they are not part of this first selected scope.
