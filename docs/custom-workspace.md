# Custom workspace prototype

Implemented and interface-reviewed November 3, 2026 on `custom-stats-layout`.
Ready for the initial layout checkpoint. Commit and push are manual steps;
the branch has not been merged into `main`.

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
layouts. Per-card filters, resizing, style customization and calculated links
are not implemented. Connections are visual, undirected and update with movement.
Remove card also removes attached lines; individual lines can be removed below
the canvas. Up to 100 cards are supported per layout. Grid snapping is 20 units;
cards may overlap if deliberately placed together. Arrange cards restores spacing.

Header pointer dragging moves cards; a focused header also supports arrow keys.
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
only layout identifiers/name, cards with metric/position and visual links.

44 offline tests and build passed. Model tests cover repeated-stat identities,
storage round trip, bad browser data, missing keys, dangling/duplicate lines,
card removal and free-space placement. Browser checks used a temporary local
server on port 5174: added points/steals cards, connected them, moved by keyboard
and pointer, saved/created a copy, reloaded and reopened both, and switched to Q1.
Q1 values changed while the saved arrangement and connection remained. Zoom
controls were exercised and the rendered canvas inspected. Narrow/mobile/touch
interaction and an actual refresh while dragging were not independently tested;
the editor shares the existing data path and keeps state across data updates.

## Review

1. Start `npm run dev`, open the app, choose Custom workspace below selected teams.
2. Add 2–3 statistics. Move headers and drag the blank background; try zoom/reset.
3. Connect two cards, remove the line, reconnect, then remove a card.
4. Name and Save. Change the name and Save a copy. Open each from Saved layout.
5. Switch quarter or team and check values change without moving cards. Switch
   Default/Custom to confirm the draft remains. Reload and reopen a saved layout.
6. Try New blank and save another layout. Check missing values use dashes and
   the Data checks section explains failing quarter metrics.

Next changes should follow feedback on this prototype before expanding card
styles, sizing, grouping or more complex card/filter relationships.
