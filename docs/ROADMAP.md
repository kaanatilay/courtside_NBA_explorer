# Statistics and layout roadmap

Current scope: all 30 NBA teams, regular season, current plus two previous seasons.
Quality checks and explicit missing-data behavior remain requirements throughout.

## Milestone 1 — selectable full-game statistics

Implemented and reviewed. Keep the original five default metrics.
Add steals; free throws made/attempted/percentage; three-pointers made/attempted/
percentage; team/game lead changes. Select displayed statistics and retain that
selection per browser. The chooser controls team summaries/logs and player
details/logs; roster previews retain their compact minutes/points/assists columns.
Lead changes is a game statistic and is excluded from player metrics.
Shooting percentages use summed makes divided by summed attempts. No attempts
or missing required data yields unavailable, never a fabricated zero.

## Milestone 2 — expanded team-quarter statistics

Implemented and interface-reviewed. Validated steals, free throws, three-pointers and lead changes
from play-by-play before enabling them. Include known period benchmarks,
full-game reconciliation, overtime, corrections, duplicate events, missing feeds
and quarter boundaries. Lead-change definition must handle ties and carry the
entering score/last leading team across quarters. Withhold metrics that fail
checks. The chooser now enables these additions for team Q1–Q4; availability
varies by metric/game. See team-quarter-stats-review.md for results and limits.

## Checkpoint and custom-layout branch

Both statistics milestones were completed, interface-reviewed and pushed before
starting the layout prototype. Layout definitions stay independent of data:
updates must not reset card arrangements or freeze values into a saved layout.
The statistics checkpoint was pushed and `custom-stats-layout` created locally
and remotely. The first custom workspace is implemented and interface-reviewed:
Default/Custom toggle; blank canvas; add/remove repeated stat cards; grid-snapped
dragging; pan/zoom; visual links; named browser-saved layouts, updates and copies.
44 tests and build passed. Browser checks exercised card addition, connection,
keyboard/pointer movement, naming/save/copy, reload/reopening and quarter changes.
Card resizing/style customization, automatic grouping and export/import remain
future work. Quarter data limitations remain documented regardless of layout.
This first layout checkpoint is ready for manual commit/push on
`custom-stats-layout`. It has not been merged into `main`. Further customization
will be planned after the checkpoint, using this prototype as the baseline.

## Continuing quality and retrieval work

- Player-quarter counting stats and minutes remain unresolved; verify athlete
  roles, lineups/substitutions and independent period examples before display.
- Defender matchup no-results issue remains undiagnosed. Archived tracking
  needs clearer coverage and attribution validation before predictive use.
- More displayed fields do not establish complete historical coverage or
  independent provider accuracy. Continue representative source checks.
- Keep the data map synchronized with reviewed capabilities and limitations.
- Field-goal and total-rebound display remain future candidate additions.
- Playoffs/play-in remain deferred while regular-season work is prioritized.
