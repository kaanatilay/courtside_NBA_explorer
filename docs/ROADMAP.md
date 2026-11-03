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
The first layout checkpoint was reviewed and pushed on `custom-stats-layout`.
It has not been merged into `main`. Quarter data limitations remain documented
regardless of layout. Export/import remains future scope.

## Customization progress — five steps

Implement one step at a time, test and explain it, then pause for interface
review before the next. Layout changes must preserve live values and older
saved layouts. Quality, verification and player-quarter research remain on the
broader roadmap rather than being replaced by presentation work.

| Step | Scope and review outcome | Status |
| --- | --- | --- |
| 1 | Undo/Redo; resize cards with safe minimum sizes; persist dimensions. One pointer gesture is one undo action. | Implemented and user-reviewed. |
| 2 | Magnetic grouping with a snap preview, size matching, group movement, individual adjustment and explicit ungrouping. Grouping is distinct from visual connection lines. | 2A user-reviewed. 2B built: Edit group/Confirm/Cancel, independent member move/resize, snap bypass; 52 tests/build passed and browser checked; user-reviewed. Ready for the steps 1–2 Git checkpoint. |
| 3 | Card editor with multiple movable/resizable inner blocks: labels, numbers and comparison bars first; Apply/Cancel. Keep blocks within the outer card; avoid an arbitrary single-block limit. | Planned. |
| 4 | Frame, card and workspace colors with presets/custom picker, reset and readable contrast guidance. | Planned. |
| 5 | Single-team, comparison and related-stat card purposes; compatible chart choices including shooting makes/misses. Distinguish data/sample settings from presentation. | Planned; exact initial chart scope to agree before implementation. |

Suggested Git checkpoints: after steps 1–2 are reviewed, then after the inner
editor, followed by colors and richer card purposes. No automatic commit/push.
Future styling can extend shape and visualization choices without changing
retrieval or silently deriving unsupported statistics.

Step 2A details: overlap an ungrouped card with a target, preview a free adjacent
slot, then release. Side-by-side matches height; stacked matches width. Prefer
the approached side, try other sides when blocked, and decline if no free slot
fits. Groups can receive more ungrouped cards; existing groups do not merge by
dragging. Group handle/member headers move the unit; Arrange retains internal
offsets. Ungroup retains positions, sizes and independent visual connections.
Each gesture/action is undoable; named layouts retain membership.

Step 2B: Edit group opens a separate working copy for individual member movement
and resize. The outline follows the members; they may overlap or spread apart
without losing membership. Confirm locks the group and records the whole session
as one undo action; Cancel leaves the original layout/history unchanged. Saving,
other layout edits and Undo/Redo pause until Confirm/Cancel. Named layouts save
the confirmed arrangement, not an editing/unlocked mode. Snapping is paused while
editing; otherwise the Magnetic snapping checkbox or Shift-drag bypasses magnets.
The checkbox is temporary workspace state, not part of a saved layout. Step 3
is next to plan after the reviewed steps 1–2 Git checkpoint; steps 4–5 remain unchanged.

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
