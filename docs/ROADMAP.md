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

**Complete and user-reviewed.** Steps 1–2 were pushed at the v.12 checkpoint;
steps 3–5 are ready for the next user-run commit/push. No merge into main or
automatic commit/push has been performed. Latest verification: 97 tests and
production build passed, with browser checks documented below.

Implement one step at a time, test and explain it, then pause for interface
review before the next. Layout changes must preserve live values and older
saved layouts. Quality, verification and player-quarter research remain on the
broader roadmap rather than being replaced by presentation work.

| Step | Scope and review outcome | Status |
| --- | --- | --- |
| 1 | Undo/Redo; resize cards with safe minimum sizes; persist dimensions. One pointer gesture is one undo action. | Implemented and user-reviewed. |
| 2 | Magnetic grouping with a snap preview, size matching, group movement, individual adjustment and explicit ungrouping. Grouping is distinct from visual connection lines. | 2A/2B complete and user-reviewed; user confirmed commit/push checkpoint (v.12). |
| 3 | Card editor with multiple movable/resizable inner blocks: labels, numbers and comparison bars first; Apply/Cancel. Keep blocks within the outer card; avoid an arbitrary single-block limit. | 3A–3C/template sizing implemented and user-reviewed. Panel redesign remains a separate follow-up. |
| 4 | Frame, card and workspace colors with presets/custom picker, reset and readable contrast guidance. | 4A/4B implemented and user-reviewed. |
| 5 | Single-team, comparison and related-stat card purposes; compatible chart choices including shooting makes/misses. Distinguish data/sample settings from presentation. | 5A/5B implemented and user-reviewed. 97 tests/build passed; browser chart/filter/history/save checks passed. |

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
is split below; steps 4–5 remain unchanged.

### Step 3 — inner card editor

- **3A (implemented and user-reviewed):** Edit card modal with current comparison preview;
  multiple label/value/horizontal bar blocks; independent statistic and slot A/B/
  both bindings; bounded pointer/keyboard movement and resizing; removal;
  Apply/Cancel, one applied-session Undo, browser save/reopen and legacy display.
  Available space and block size govern additions (100-block safety ceiling).
  Outer resize/magnetic matching protects applied content from clipping.
- **3B.1 (implemented and user-reviewed):** numeric X/Y/width/height fields with clear
  bounds; optional 8 px pointer grid; edge/center alignment guides (5 px range);
  clearer selection/numbered handles; 1 px arrows and Shift+8 px arrows. Exact
  numeric/keyboard adjustments bypass snapping. Resize keeps the top-left fixed.
  Editor-only toggles/guides are not saved; applied geometry is.
- **3B.2 (implemented; user proceeded to 3C):** independent block duplication (free space
  preferred; bounded overlap fallback explained), forward/backward paint layers,
  checkbox/modifier-click multi-selection, six alignments and equal horizontal/
  vertical edge gaps. Alignment uses selected bounds; spacing needs 3+ blocks
  and declines when no nonnegative gaps fit. Fields/handles edit the active block
  only. Applied block order/geometry persists through save/history. Outer resize
  shows the actual content minimum and explains how to reduce it.
- **3C (implemented and user-reviewed):** vertical bars, per-block label/
  value visibility and 0–3 decimal places; contextual chart suitability and
  relative-scale guidance; named browser-local templates with update/save-copy
  and independently editable loads. Templates preserve bindings/order/settings,
  never live values. Default loading restores template outer size; explicit Keep
  current card size checks fit. Size and content share Apply/Cancel and one Undo;
  overlap previews warn without moving neighbors/groups. Workspaces save the whole arrangement; templates reuse a card's
  design. Makes/misses donut charts were added and reviewed in step 5B.

The step-3 editor and template-size correction were reviewed before steps 4–5.
See [card editor](card-editor.md) for behavior, verification and manual checks.

### Follow-up — editor interface redesign

User explicitly wants to revisit/redesign the editor panels and card-editing
tools after the functional pass. Track consolidated feedback on control
organization, clarity and editing flow, and agree a separate reviewable scope.
Preserve saved designs/templates. This redesign is not implemented here.
Agree its scope after the completed five-step milestone and Git checkpoint.

### Step 4 — appearance controls

- **4A (implemented and user-reviewed):** per-card background/border and workspace
  background presets, native picker, validated hex entry and resets. Card edits
  use existing Apply/Cancel. Workspace preview has its own Apply/Cancel so picker
  changes commit as one Undo action. Named layouts retain colors; old layouts,
  data and geometry stay intact. See [appearance controls](appearance.md).
- **4B (implemented and user-reviewed):** automatic main/secondary text and chart
  colors, Paper presets, separate canvas line/grid adaptation, contrast feedback
  and a contrasting-border action. Templates capture card appearance; legacy
  templates retain destination colors, explicit empty appearance restores defaults.

Step 4 was reviewed before step 5. The panel redesign remains separate.

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

### Step 5A — card purpose and data bindings

Implemented Single team, Team comparison and Related statistics purpose controls.
Single/related bind every block to one chosen selection slot; comparison binds
each statistic to both teams. Flexible / legacy preserves mixed per-block slots.
Changing purpose updates slots without removing blocks or changing metrics.
Returning to Flexible keeps those updated slots; Cancel restores the original.
Related statistics is a manual multi-stat design, not an automatic metric bundle.
Season/quarter/sample filters remain in the main interface. Layouts and templates
retain purpose; old records remain flexible. Apply/Cancel and one Undo include
purpose, contents, frame and colors. No retrieval changes.

Verification: 93 offline tests and build passed. Browser checked legacy opening,
Single A/B values, comparison both values, Related binding and applied canvas.
Tests cover live/missing/weighted values, history, JSON reload and template copies.
5A was user-reviewed before implementing 5B shooting makes/misses donut charts.
Panel redesign remains separate; nothing committed or pushed automatically.

### Step 5B — shooting makes/misses donuts

Implemented a donut inner-block type with two compatible data choices: free
throws and three-pointers. Each selected team has its own chart. Makes and
misses partition total attempts; misses = attempts − makes. Percentage uses
summed makes / attempts. Counts in these charts are sample totals, clearly
labeled, while number/bar counts remain per-game averages. Zero makes and
perfect shooting are valid; empty samples, no attempts and any missing/invalid
observation show an explanation without a chart. Quarter filters use the same
checked rows and retain existing availability limits. No new source/retrieval.

Minimum block frame: 240 × 180 px. Enlarge the outer card before adding/converting
if necessary. Donuts preserve decimal/label/value controls, team binding, colors,
geometry, templates and named layouts. Only supported shooting choices appear
for a donut; changing from another metric defaults to free throws.

97 tests and build passed. Browser checked free throws, three-pointers, Paper
background, Undo/Redo, Q1 incomplete-data withholding, Save copy and reload.
Tests cover zero/perfect/no attempts, invalid/incomplete samples, layout/template
round trips and live totals. The user accepted 5B, completing the five-step
functional milestone. Panel redesign remains separately planned.
