# All-team selection band and connection review

Completed November 2, 2026. The collection and comparison interface now both
support all 30 NBA teams. No bulk history import, playoff controls, player
quarters, or new provider was introduced.

## Changes

The horizontal band sorts teams by city/name and offers Team A/Team B slot
buttons. Cards display canonical abbreviations, names and color accents.
Both selected teams are marked; the active slot uses pressed state, and the
other slot's team is unavailable for selection. It stays focusable with an
explanation for keyboard users. Tab/Enter and Left/Right/Home/End are supported.
Arrow controls scroll about three quarters of the visible width; native
horizontal scrolling remains available. Reduced-motion preferences are respected.

Below the band, compact selected-team summaries lead into existing filters,
team comparisons, participant lists and player logs. Selection changes close
old player details and cancel superseded requests. The shared catalog enables
all teams in API input validation too. Washington's ESPN abbreviation WSH now
normalizes to WAS; existing GS/NY/NO/SA/UTAH aliases are preserved.

The defender normalizer now gets the selected team's NBA ID from the already
verified NBA game schedule, replacing a four-team lookup. This broadens identity
support without implying all-team archive coverage; missing tracking remains
unavailable. ESPN IDs and NBA IDs stay separate.

## Verified

- 33 offline tests passed and the production build passed.
- Catalog checks matched 30 unique ESPN identities from the saved league audit,
  checked API validation for every team and duplicate-team rejection, and
  exercised Washington normalization.
- A temporary real Vite API server served 30 current-season Last 3 comparisons
  and 30 participant-detail requests against the saved league collection.
  Evidence: `all-team-comparison-check.json`. No league refresh was launched.
- Browser automation and its desktop fallback both failed initialization with
  `failed to write kernel assets: The system cannot find the path specified`.
  Visual appearance, keyboard interactions and narrow-width layout therefore
  remain for user review. Responsive CSS was added but not screenshot-verified.

## Review the complete connection

1. Restart `npm run dev` if needed, then reload the page. Confirm the team band
   sits above the selected-team summaries, filters and comparison.
2. Choose Team A, then Denver; choose Team B, then Minnesota. Use current season,
   All opponents and Last 3. Check that the headings and dated games follow the
   selected teams and indicate saved records.
3. Try selecting Minnesota for Team A while it is Team B. It should remain
   unavailable, preserving two different teams. Try the arrow controls and
   keyboard navigation to reach Washington and Utah at the end of the band.
4. Open Players, select a participant and inspect the dated appearance log.
   Changing teams should close that detail rather than carry over old context.
5. Run Refresh league data. It still updates all 30 teams in the current regular
   season independently of the displayed pair. Check progress and completion;
   recent games may be re-downloaded but shouldn't create extra game rows.
6. Restart the server and reopen the same pair: saved records should still work.
   Optionally disconnect the network after loading; viewing saved samples should
   work, while refreshing reports failures. Reconnect afterward.
7. Narrow the browser window. Check that the band scrolls inside its container,
   the page doesn't overflow sideways, and the two slots remain usable.

Current-season saved records cover the last successful league cycle, not future
games. Historical selections fetch missing records on demand; they are not a
completed whole-league historical import. Provider gaps may still produce errors.
