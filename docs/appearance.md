# Appearance controls — steps 4A–4B

Built and user-reviewed on custom-stats-layout. Steps 4A/4B and step 5 are
complete; the separate panel/tool redesign remains planned.

## Behavior

Edit card → Card colors previews a background and border. Use a dark preset,
the native color picker, or exact #RRGGBB hex entry. Hex commits on Enter/blur;
invalid input keeps the previous color with an explanation. Custom indicates
picker/hex colors. Reset individually or Reset all card colors. Apply commits
size/content/appearance as one Undo action; Cancel keeps the previous card.

Workspace colors previews its background while other layout edits are paused.
Apply is one history action; Cancel discards the preview. Reset previews the
original background. The dots/grid remain visible. Use workspace Save/Save a
copy to persist applied colors. Undo/Redo covers edits and resets. Resets do not
alter stats/bindings, samples, sizes, positions, groups, links or block settings.

Named layouts save optional root background and per-card appearance. Only opaque
six-digit hex colors are accepted, never arbitrary CSS. Missing/invalid overrides
use the original palette, so old layouts need no migration. Card header/body
use the chosen background; overrides now derive readable text/chart colors.

4B chooses the higher-contrast black/white text using linear sRGB luminance.
Secondary text is softened only while meeting a 4.5:1 design target. Bar fills
adapt if the original green blends into the background. Canvas lines/grid adapt
separately; cards retain independent palettes. Paper presets exercise light themes.
Border contrast has 3:1 guidance and a Use contrasting border action. These are
color-pair checks, not blanket accessibility certification: overlaps, tiny frames
and hidden labels still matter. Old cards without background overrides retain
their original palette. Controls outside the canvas keep their existing theme.

Templates now save explicit card colors, never derived text colors or workspace
styling. Each loaded appearance is independent and joins the size/content draft.
Legacy templates without appearance keep destination colors; explicit empty
appearance in a newly saved template restores defaults. Update/save-copy can
upgrade old templates. The panel redesign remains separate.

## Code and verification

appearance.js validates colors and supplies defaults/presets/CSS variables.
ColorControl.jsx shares preset/picker/hex/reset controls. CardEditor owns a
disposable appearance draft; CustomWorkspace owns the workspace preview.
layout.js preserves/sanitizes appearance through history and saved libraries.

89 offline tests and production build passed. The five 4A tests cover strict color
validation/CSS stripping, legacy and invalid saved overrides, independent card/
workspace history/storage, resets preserving geometry/bindings/groups/lines,
and all presets/default omission.

Browser checks used temporary port 5174: Night preview/Cancel to Forest; invalid
hex rejection; custom workspace Apply/Undo/Redo; card presets; background reset
preserving Gold border; card Cancel restoring original colors; Apply/Undo/Redo;
save-copy/reload/reopen retaining Ocean #123442, Gold #d9b971 and workspace
#18202c. Workspace reset/Cancel restored the custom background. Only one card
changed; neighbors/groups/data remained. The native OS picker dialog, mobile/
touch were not independently tested.

Seven 4B tests add known contrast endpoints, 216 sampled colors checking primary/
secondary text against 4.5:1, separate canvas adaptation, derived palette storage,
styled-template validation/independence, legacy versus explicit-default semantics,
and template appearance joining size/content Apply/Undo/Redo/storage.

4B browser checks confirmed Ocean light text (13.16:1), Paper dark text (18.43:1),
Gold border warning (1.66:1) and contrasting-border action. Legacy loading kept
Ocean/Gold; a saved Paper/black-border template survived Cancel/reopening and
restored its colors. A second copy changed to Plum without altering the first.
Apply/Undo/Redo worked. After resuming, the persisted styled template and Paper
canvas (17.58:1) were saved as a layout copy, reloaded and reopened. Light card
text/charts and canvas lines remained readable; the dark legacy neighbor retained
its palette. Native picker/mobile and exhaustive assistive-technology behavior
were not independently tested.

## Review

1. Edit card → Card colors: try presets, picker/hex and individual/all resets.
2. Cancel/reopen, then Apply another palette. Try Undo/Redo.
3. Workspace colors: preview/reset/Cancel, then Apply and Undo/Redo.
4. Save/reload/reopen; confirm independent card colors and unchanged stats/layout.

5. Try Paper/dark presets and contrast feedback; use the border action.
6. Save a styled template, load it elsewhere, edit independently, Apply/Undo/Redo
   and save/reopen the layout. Check legacy template behavior too.

Step 4 was reviewed before step 5; the full five-step milestone is now user-reviewed.
