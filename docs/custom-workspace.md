# Custom workspace prototype

Implemented and interface-reviewed November 3, 2026 on `custom-stats-layout`.
Initial checkpoint reviewed and pushed; the branch has not been merged into
`main`. Customization steps 1 and 2A are user-reviewed; 2B is implemented and user-reviewed. The five-step
tracker lives in [ROADMAP.md](ROADMAP.md).

## Behavior and boundaries

The toggle below selected teams switches Default and Custom workspace. Existing
comparison data/filters are shared. The custom canvas is separate presentation
state: changes to teams, periods, samples or fresh data update values without
resetting positions. Switching modes preserves the open draft during the app
session. Player views switch to Default; this prototype has team-comparison
cards, not independently filtered team/player cards.

Cards are added independently of Choose stats and may repeat a statistic. Each
card displays both selected teams' current sample averages/percentages, using the
same missing-aware calculation functions as Default. Values are not saved into
layouts. Per-card filters, style customization and calculated links are not
implemented. Connections are visual, undirected and update with movement/resize.
Remove card also removes attached lines; individual lines can be removed below
the canvas. Up to 100 cards are supported per layout. Grid snapping is 20 units;
independent cards can still overlap through resizing/keyboard movement or when
no magnetic slot is free. Arrange cards restores spacing.

Magnetic groups (2A): dragging an ungrouped card over another shows a dashed
preview of an available adjacent slot. Release to match height side-by-side or
width when stacked, leaving approximately 20 canvas units between cards. Other
sides are considered if the approached side is blocked; no valid slot means no
snap. A card can join an existing group; whole-group merging is not implemented.
The dashed group outline has a Move group handle and Ungroup button. When too
close to the canvas top, its controls appear below the group to remain reachable.
Member headers also move the whole group; focused group/header handles support
arrow keys. Group movement clamps one shared delta to preserve spacing at edges.
Arrange treats groups as units. Ungroup preserves positions, matched sizes and
visual connection lines. Removing members dissolves groups with fewer than two
remaining cards. All actions use Undo/Redo and membership is saved in layouts.
Choose Edit group to unlock member headers and resize corners. Only this group's
members can be adjusted until Confirm/Cancel; its outline follows their extents.
Membership and visual lines remain intact even when members overlap or separate.
Confirm locks the group again and records the entire edit session as one undo
action. Cancel discards its working copy, preserving previous Undo/Redo history.
Saving, naming, other layout edits and Undo/Redo pause during editing; background
panning and data/filter updates remain available. Confirm/Cancel stays visible
when scrolling. Save after Confirm to retain the arrangement across reloads;
the unlocked editing mode itself is never saved. Reload loses unconfirmed edits.

Magnetic snapping can be turned off with the toolbar checkbox or temporarily
bypassed by holding Shift during a drag/release. Snapping pauses automatically
during group editing. Bypass affects magnetic grouping, not the 20-unit movement
grid. The checkbox resets on reload and is not saved in named layouts.

Header pointer dragging moves cards; a focused header also supports arrow keys.
Drag the bottom-right corner to resize; its focused button supports arrow keys
in 20-unit steps. Sizes range from 260 × 190 to 1200 × 1000 canvas units and
are saved with positions. Older layouts open at the original default size.
Arrange/new-card placement accounts for resized rectangles.

Undo/Redo covers card changes, connections, arrangement and layout names, with
up to 100 actions. Each completed pointer move/resize is one action; cancelled
gestures restore the previous state. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or
Ctrl+Y redoes when focus is outside text fields. A new edit clears redo.
History is session-only and resets on opening another/blank layout or reloading;
Save retains current history. Undo does not undo saving to the library: save
again to persist the restored state. It never rolls back data refreshes or filters.
Background dragging pans and +/- zooms from 50–200%. Reset view resets the camera,
not saved positions; Arrange cards changes positions and marks the draft unsaved.
Pan/zoom is temporary presentation state and is not saved into named layouts.

Named layouts live under `courtside:custom-layouts:v1` in localStorage, per browser
profile/origin (different ports have separate libraries). Save updates the opened
layout; Save a copy creates a distinct record, and names need not be unique.
Opening another/blank layout asks before discarding dirty changes. Reload/closing
loses unsaved drafts: save first. Storage errors are visible and retain the canvas.
Layouts are not synchronized between computers or included in Git. Saved-layout
deletion, backup/export/import and live cross-tab library synchronization remain
future scope.

## Structure and verification

`src/CustomWorkspace.jsx` handles the editor and cards. `src/layout.js` validates
stored definitions, snaps/places cards, and maintains connections. Invalid keys,
bad coordinates and dangling/repeated links are discarded. A saved object holds
only layout identifiers/name, cards with metric/position/dimensions, visual links
and groups containing card IDs. Legacy layouts get an empty groups collection;
invalid, duplicate or dangling memberships are discarded.

52 offline tests and build passed for customization step 2B. Model tests cover repeated-stat identities,
storage round trip, bad browser data, missing keys, dangling/duplicate lines,
card removal, resize bounds/legacy migration, single-action gesture history,
undo restoring removed connections, redo branching and size-aware placement.
Browser checks used a temporary local
server on port 5174: added points/steals cards, connected them, moved by keyboard
and pointer, saved/created a copy, reloaded and reopened both, and switched to Q1.
Q1 values changed while the saved arrangement and connection remained. Zoom
controls were exercised and the rendered canvas inspected. Narrow/mobile/touch
interaction and an actual refresh while dragging were not independently tested;
the editor shares the existing data path and keeps state across data updates.
Step 1 browser checks additionally exercised keyboard/pointer resize, Undo/Redo,
one undo restoring a whole pointer resize, and saved dimensions after reload.
Step 2A model checks cover directional placement/dimension matching, blocked
slots, independent membership, adding a third member, removal cleanup, bounded
group movement, history/storage round trips and group-preserving arrangement.
Browser checks verified pointer snapping with height matching, group-handle
movement, separate undo of movement/grouping, ungroup/undo and save-copy/reload
reopening with the group intact. Touch/mobile and large-layout stress behavior
have not been independently checked.
Step 2B browser checks exercised keyboard member move/resize with Cancel,
pointer member move/resize with Confirm, one Undo restoring both changes, Redo,
Cancel preserving existing redo, and save/reload/reopen retaining membership,
position and dimensions. Turning magnets off allowed pointer overlap without
grouping. Shift-modified pointer dragging was not separately automated. The
existing model suite remains unchanged; transaction behavior was checked in the
actual React interface rather than adding tests that duplicate the same helpers.

## Review

1. Start `npm run dev`, open the app, choose Custom workspace below selected teams.
2. Add 2–3 statistics. Move headers and drag the blank background; try zoom/reset.
3. Connect two cards, remove the line, reconnect, then remove a card.
4. Name and Save. Change the name and Save a copy. Open each from Saved layout.
5. Switch quarter or team and check values change without moving cards. Switch
   Default/Custom to confirm the draft remains. Reload and reopen a saved layout.
6. Try New blank and save another layout. Check missing values use dashes and
   the Data checks section explains failing quarter metrics.

7. Drag a resize corner, Undo once, then Redo. Focus the resize corner and use
   arrow keys; check the minimum size remains usable. Save, reload and reopen.
8. Remove a connected card and Undo to recover both card and line. Arrange and
   Undo. Edit after Undo and confirm Redo clears. Pan/zoom should not consume Undo.

9. Overlap one ungrouped card with another. Inspect the preview and release;
   check the matched edge and dashed group outline. Move the group handle and
   Undo once, then Undo the grouping; Redo. Try Ungroup and Undo.
10. Save and reload/reopen the group. Try adding a third card and snapping it
    onto a member, then Arrange. Group spacing should remain intact.

11. Choose Edit group. Move one member and resize it; other members should stay
    put while the boundary follows. Cancel and check the original arrangement.
12. Edit again, Confirm, then Undo once to restore the whole session; Redo.
    Save and reload/reopen: the group should be locked with its new arrangement.
13. Turn Magnetic snapping off (or hold Shift while dragging) and overlap two
    ungrouped cards. They should remain independent. Turn it back on to snap.

Steps 1–2 are user-reviewed and ready for manual commit/push. Next: plan the inner card editor in step 3.
