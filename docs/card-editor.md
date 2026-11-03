# Custom card editor — steps 3–5

Implemented and user-reviewed on custom-stats-layout. The five-step functional
customization milestone is complete; panel/tool redesign remains a separate
follow-up. Steps 1–2 were pushed before this work.

## What is available

Edit card opens a modal with the current selected teams/sample/period. It uses
a separate working copy. Add/remove multiple statistic value, team/statistic
label and horizontal comparison bar blocks. Each block has its own statistic
and Team A, Team B or both binding. Bindings follow selection slots rather than
freezing team identities or numbers. Current shared filters apply to all blocks.

Select through the block dropdown or click the preview. Drag the small top-left
Move handle or bottom-right resize corner; focused handles accept arrow keys in
1 px steps, or Shift+arrows for 8 px. Preview coordinates use unscaled interior pixels. Large interiors
scroll within the panel. Blocks stay inside the frame; overlap is allowed.
Apply commits the entire session as one Undo action; Cancel/Escape discards it
without changing previous history. The native dialog traps focus and makes the
background inactive. Finish group editing before editing a card's interior.

Applying does not save to the named library: use Save/Save a copy afterward.
Reload loses unapplied/unsaved edits. Old cards keep their original appearance
until Apply. Removing all blocks and applying deliberately saves an empty design.

New blocks are placed in free space. Capacity grows with interior area, with a
100-block safety ceiling; a full interior asks you to shrink/remove blocks or
Cancel and enlarge the outer card. Borders/header/actions remain outside the
editable interior. Applied block extents establish minimum outer dimensions;
resizing cannot clip them and incompatible magnetic size matches are skipped.
Move/shrink inner blocks first if you want to shrink the outer card further.

Numbers use the existing missing-aware sample calculations: counts are averages;
shooting percentages use summed makes/attempts. Missing or zero-attempt samples
display a dash. Bars are relative to the largest shown team value, including
when the metric itself is a shooting percentage. With any selected team missing,
bar lengths are withheld; known numbers remain visible. Both zero values produce
zero-length bars. Loading/errors suppress stale values/bars. Data checks include
every metric used in the applied blocks, independently of the card header metric.

## Code and verification

- src/cardDesign.js: validates layout-only block definitions, placement/bounds,
  team-slot bindings and comparison widths; it never stores provider values.
- src/CardContent.jsx: shared live renderer for preview and applied cards.
- src/CardEditor.jsx: disposable modal draft, selection and pointer/keyboard input.
- src/blockGeometry.js: anchored numeric geometry, optional grid and nearest
  valid alignment guides, shared bounds for precise input.
- src/blockArrange.js: immutable duplication, layer order, selected alignment
  and equal-gap placement; no data values or retrieval changes.
- src/cardTemplates.js: validated browser-local reusable definitions and
  independent ID creation/fit checks when loading another card's design.
- src/layout.js: retains/sanitizes blocks through save/load/history/groups and
  protects contents during outer resize/magnetic matching.
- src/CustomWorkspace.jsx: opens the editor and commits Apply into history.

89 offline tests and production build passed through 4B. The five 3A tests cover legacy versus
empty designs, corrupted data/value stripping, bounded geometry/free-space
placement, slot bindings/weighted percentages/missing/zero bars, history/storage
round trips and preserving designs through resize, magnets, grouping/arrangement.

Browser checks on temporary port 5174 covered an existing grouped card, adding
all three block types, Team A-only values and both-team bars, metric changes,
pointer movement, keyboard movement/resize, Cancel restoring legacy display,
Apply/one Undo/Redo, save-copy/reload/reopen with membership/design intact.
Changing Full game to Q1 changed points 119.8 → 30.6 and FT% bars
77.9/78.3 → 77.4/76.5 in the tested BOS/LAL sample. Changing Team A to NYK
updated its label/value to 27.0 Q1 points and 90.9% FT without changing the
saved design. These observed samples can change as games/corrections arrive.

Touch/mobile, very large designs and exhaustive keyboard/screen-reader behavior
were not independently tested. Card/workspace colors are available in 4A;
automatic readable text/template colors are implemented in 4B. Small frames or deliberate overlap can still make content hard
to read; the arrangement controls provide manual ways to adjust them.

## Precise positioning — 3B.1

Selected blocks have a stronger outline and numbered Move handle. Focus either
handle to select that block. X/Y measure its top-left corner from the interior's
top-left; width/height are in canvas pixels. Numeric fields commit on Enter or
blur, so partially typed/empty text does not immediately move the block. Escape
reverts that field without cancelling the modal. Invalid/blank input preserves
the original value; out-of-range numbers clamp with a status explanation. Field
tooltips list valid ranges; type minimum dimensions are shown below the controls.

Snap to 8 px grid defaults off. Alignment guides default on. Both apply to pointer
dragging/resizing only; numeric input and 1 px/Shift+8 px keyboard adjustments
remain exact. Guides align an edge/center to another block or the card interior
within 5 px, and can override grid snapping. Guide lines appear only when the
final bounded geometry actually aligns. Resize snaps the trailing edge while
keeping the top-left corner fixed. Constraints take precedence over snapping;
frame edges need not lie on the grid. Pointer deltas account for preview scrolling.
The checkbox settings and guides are temporary editor state, reset on reopening
and excluded from saved definitions. Apply/Cancel/history behavior is unchanged.

Five additional model tests cover finite/clamped geometry, fixed resize anchors,
grid rounding/boundaries, edge/center alignment and guide precedence/disable,
minimum-size rejection, plus precise-coordinate history/storage round trips.
Browser checks verified numeric X=23; keyboard +1/+8 reaching 32; oversized width
clamping at 366 without moving X=32; empty input preservation and field Escape;
an edge-guided drag landing at X=32; grid-only dragging landing at X=48/Y=80;
keyboard resizing by 1/8 px; Cancel restoring the original; Apply/Undo/Redo;
save-copy/reload/reopen retaining X=23 and width=300. Transient guide line rendering
and scroll-during-drag were not independently captured in a browser check;
alignment results and model geometry were verified.

## Faster arrangement — 3B.2

Duplicate block creates a new independently editable ID with the source's type,
statistic, team binding, size and label settings. It tries free space; a full
frame gets a bounded offset/overlap with an explanation (unless its area-based
capacity is reached). The copy starts at the front of the layer order.

Bring forward/Send backward swaps the active block one layer at a time. Both
preview and applied cards paint in array order, back → front. Selection never
secretly raises a block. Block numbers reflect current layer positions; identity
and data bindings remain stable through reordering. Use the dropdown/selection
list to reach a fully covered block.

Expand Arrange blocks. Check boxes, Select all/Clear, or Shift/Ctrl/Cmd-click a
block preview to change the arrangement selection. The green outline identifies
the active block whose property fields are displayed; other selected blocks use
cyan outlines. Drag/resize and property fields affect only the active block;
multi-selection currently applies to alignment and spacing, not group dragging.

Align 2+ blocks to selected left/right/top/bottom edges or horizontal/vertical
centers. Sizes and unselected blocks remain unchanged. Equal horizontal/vertical
gaps needs 3+ blocks and preserves the outer envelope, with positions rounded to
whole pixels (gaps may differ by 1 px). Insufficient room leaves the design
unchanged and explains how to make space. Alignment can deliberately overlap
blocks. Snap toggles do not alter these explicit arrangement operations.

Apply records the entire session, including copies/order/positions, as one Undo
action. Cancel restores the original. Save retains those definitions; the active
and arrangement selections are temporary. The outer resize tooltip now reports
the content-based minimum. A blocked resize explains that inner blocks must be
moved/shrunk through Edit card before the outer frame can shrink further.

Six new model tests cover duplication/independence/crowded fallback, layer bounds,
all six alignments, variable-size horizontal/vertical spacing and rounding,
insufficient-space no-ops and history/storage paint-order round trips. Browser
checks covered label duplication, both layer directions, checkbox selection/right
alignment, rejected crowded spacing, Cancel restoring the original, successful
four-block left alignment/equal vertical gaps, Apply/Undo/Redo, outer height-limit
feedback and save-copy/reload/reopen retaining four blocks, with the bar first
in paint order at X=0/Y=106. Modifier-click variants, capacity exhaustion and
pointer-based outer limit feedback were not separately exercised in the browser;
checkbox selection, model capacity and keyboard outer feedback were checked.

## Visualization and reuse — 3C

Block visualization can switch the active block between numbers, labels and
horizontal/vertical bars. Vertical bars require at least 160 × 120 interior
pixels; unavailable choices explain the need to enlarge the outer card. Changing
type fits its minimum into the current interior and may move the block inward.
Each non-label block has Show labels, Show values and 0–3 decimal places. Defaults
remain labels/values visible with one decimal. These affect presentation only;
calculations retain their original precision. Hover retains the metric/value.
Hiding labels/values does not turn unavailable data into a zero-length observation:
loading/missing indicators remain visible when a value is hidden.

Contextual guidance explains that numbers suit individual/exact inspection and
bars suit magnitude comparisons. Both bar orientations use the same relative
largest-value scale and missing-data behavior. Single-team bars are relative to
themselves; a number generally gives clearer context. Shooting percentage bar
lengths are still relative, not a fixed 0–100% axis. Shooting makes/misses donuts were subsequently added in step 5B.

Card templates is a separate browser/origin-local library under
`courtside:card-templates:v1`, with up to 50 definitions. Name and Save template
creates/updates the selected record; Save template copy creates a separate record.
Select New template to start a new named record from the current working design.
These saves happen immediately and survive Cancel card edit. Load template
replaces only the working draft; Cancel restores the original card. Apply and
workspace Save remain separate. A loaded design gets fresh block IDs, preserving
its statistic/team-slot bindings, settings and paint order. Editing it does not
change the template, other loaded cards or the original source design.

Templates contain a reference frame and block definitions, never live numbers,
fixed team identities or sample filters. Current selections supply the values.
Use template card size is now the default: restore the reference frame's width/
height, including unused space, plus its design. Keep current card size is an
explicit alternative, refusing non-fitting contents rather than scaling/clipping.
Loading changes the preview only. Apply commits dimensions and design as one Undo
action; Cancel restores both. Workspace Save persists the result. Template saves
use the working frame. Legacy non-grid sizes round upward to 10-unit dimensions
so layout saving cannot shrink the preview. Empty templates are allowed.
Export/import/deletion/cross-tab synchronization are not included.

The header reports outer/interior size. Overlapping frames produce a footprint
preview: green is the edited card, orange its neighbors. Apply preserves positions
and group membership; the group boundary follows the new size. Overlap is allowed;
rearrange in the workspace afterward. This is a warning, not auto-arrangement.

Three sizing tests cover source-frame restoration versus explicit keep-size;
one size/content history/storage transaction retaining neighbors/groups; and
legacy dimension normalization. Browser checks used a grouped 260 × 190 card:
keep-size loading refused the design; default loading previewed 400 × 270 and
neighbor overlap. Cancel restored the original; one Undo/Redo restored both size
and content; save/reload/reopen retained 400 × 270 and group membership.

Six additional tests cover vertical sizing/settings validation, rounding, corrupt
or blocked template storage, definitions excluding live data, independent loads,
non-fitting/empty templates and layout Apply/Undo/storage round trips. Browser
checks covered vertical conversion, two-decimal FT values (77.85%/78.34%), label/
value visibility, saving a template then Cancel/reopening, loading and Apply/
Undo/Redo, refusing a small target, enlarging then successfully loading a second
card, changing that copy to 0 decimals while the first retained 2, and workspace
save-copy/reload/reopen preserving both designs. Template update/save-copy errors
and hidden missing-value/vertical-loading states were not separately exercised
in the browser; persistence validation and missing/zero semantics are model-tested.

## Review

1. Open Custom workspace; enlarge a card if you want more room, then Edit card.
2. Add a label and horizontal bar; choose each block's statistic/team binding.
3. Drag Move/resize handles and try their arrow keys. Check the frame boundaries.
4. Cancel and confirm the original card remains. Reopen, design again and Apply.
5. Undo once, then Redo. Save, reload and reopen the layout.
6. Change quarter/team and check the values/labels update without moving blocks.
7. Try a missing quarter metric: expect dashes/withheld bars and Data checks.

8. Enter X/Y/Width/Height and press Enter or Tab. Try blank/oversized input;
   check that bounds are explained and resizing leaves the top-left fixed.
9. Use arrows, then Shift+arrows on both handles. Turn guides off to try the
   grid alone; turn grid off and guides on to align nearby edges/centers.
10. Cancel/reopen to confirm rollback; Apply/Undo/Redo, Save/reload/reopen to
    confirm exact geometry persists. Editor checkbox settings reset on reopen.

11. Duplicate a block and change its binding to confirm independent editing.
    Overlap blocks and try Bring forward/Send backward; inspect their order.
12. Expand Arrange blocks, check 2+ blocks and align. Check 3+ and apply equal
    gaps; try a crowded selection and expect an explanation rather than overlap.
13. Cancel and reopen; then Apply another arrangement, Undo/Redo, Save and reopen.
14. Try shrinking a card against its content minimum and read the explanation.

15. Switch a block to vertical bars. Try label/value visibility and decimal places.
16. Name and Save template; Cancel the card edit and reopen to check it remains.
17. Load it into another sufficiently large card, change the loaded copy, Apply
    and Save the workspace. Check the source card/template remain independent.
18. Reload/reopen; change teams/quarter and review the complete editor workflow.

19. Save a large card template, then load it on a new small card. Default loading
    should restore the saved outer size. Try Keep current card size, Cancel,
    Apply/Undo/Redo, overlap feedback and workspace Save/reopen.

The sizing correction was reviewed before step 4. The requested panel/card-tool redesign
is tracked in ROADMAP.md as a follow-up requiring its own agreed scope.

The user subsequently reviewed sizing and approved 4A. Card colors now opens
background/border presets, picker/hex entry and resets in the disposable draft.
Apply/Cancel and Undo include appearance with size/content. Workspace colors has
its own preview transaction. See [appearance.md](appearance.md); 4A/4B are user-reviewed. Panel/tool redesign remains tracked, not implemented.

4B was subsequently approved and completed: adaptive text/chart/canvas colors,
contrast feedback, readable-border action and reusable-template appearance.
Legacy templates keep destination colors; explicit-default templates restore
the original palette. Verification is in appearance.md; step 4 was reviewed
before step 5.

## Step 5 review — purposes and shooting donuts

5A is user-reviewed. Card purpose sets shared slot bindings: Single/Related use
one selected team; Comparison uses both; Flexible preserves per-block choices.
Related is a manual multi-stat design. Main season/period/sample filters control
the data, independently from card appearance.

5B adds Shooting makes / misses donut. Enlarge the card to at least 270 px high
(more if other blocks occupy the space), then convert a block or add a donut
where a 240 × 180 px block fits. Select Free throws or Three-pointers in Block
statistic. Each team has a separate circle; the pieces are made and missed,
whose sum is attempts. Counts are totals across the selected sample; percentage
is summed makes / attempts. Missing data never silently reduces the sample.
No attempts yields an explanation; zero makes and perfect shooting are valid.

Review: try both shooting choices, one/both teams, a quarter, light/dark colors,
Apply/Cancel, Undo/Redo, templates and workspace Save/reload. Existing blocks
retain their behavior; counts on number/bar blocks remain per-game averages.
97 tests/build passed. Browser checked both choices, light colors, Q1 missing
sample, Undo/Redo and saved-layout reload. 5B is now user-reviewed, completing
the five-step milestone; panel redesign remains separate.
