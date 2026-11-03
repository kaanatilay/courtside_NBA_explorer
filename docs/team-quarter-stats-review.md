# Expanded team-quarter statistics

Implemented and interface-reviewed November 2, 2026. The stat chooser now
supports steals, FT made/attempted/%, 3PT made/attempted/% and game lead changes
in team Q1–Q4 views. Player-quarter counting stats and minutes remain unverified.

## How values are obtained

The existing parser validates IDs, participant lists, clocks, duplicate versions,
period endings and per-period points. New counts follow each event's explicit
period; late arrival order does not move an event into the next quarter.

- Steals appear on the offensive turnover event. Both the offensive participant
  and opposing stealing participant must be verified against the game rosters.
- FT attempts include technicals and misses. Shooter, event type, outcome and
  scoring value must agree; missing/ambiguous attribution withholds the pair.
- Three-point attempts use structured pointsAttempted where supplied, explicit
  three-point descriptions, or a made shot worth three. Ambiguous shots are not
  assigned using distance, the final total, or shot-type guesses. Conflicting
  structured values fail safely. Some older compact fixtures omit this field.
- Every new counting metric is reconciled against its corresponding full-game
  box-score value, including overtime. A mismatch/missing comparator withholds
  that metric across periods while keeping unrelated passing metrics available.
- Shooting percentages use combined quarter makes/attempts. No attempts yields
  unavailable; a valid 0 makes on positive attempts yields 0%.
- Lead changes use chronological period/clock order with sequence as tie-break.
  The first lead is not a change; ties retain the last non-tied leader, including
  across quarters. Each scoring snapshot must match the reconstructed score,
  and period change counts must sum to the published whole-game lead changes.
  This is a game statistic appearing on both team rows, not a team achievement.

Corrected scoring feeds can reconcile final/period totals while disagreeing
with intermediate snapshots. Lead changes are deliberately withheld then.
Historical missing whole-game leadChanges also withholds quarter lead changes.
Q4 excludes overtime. OT counts are retained but there is no separate selector.

## Verification and remaining limitations

41 offline tests passed; production build passed. Tests include reviewed recent
GSW Q1 and Detroit OT counts, structured missed-shot classification, technical
free throws, ties and cross-quarter lead changes, wrong snapshots, ambiguous
steals, missing attempts, conflicting duplicates, feed reversal and the original
team-quarter benchmarks. These are source consistency/controlled-case tests,
not independent certification of the original provider's event attribution.

Read-only replay of 200 locally saved team-game records passed these full-game
reconciliation checks: steals 198/200; FT makes and attempts 200/200; 3PT makes
195/200; 3PT attempts 115/200; lead changes 158/200. Existing core pass counts:
AST 199, OREB 197, DREB 197, BLK 193. This is a changing local sample, not an
all-season completeness estimate. Source mismatches and ambiguous metadata
remain actual limitations, particularly for 3PT attempts and lead chronology.
No new download, bulk refresh or database rewrite was needed for this replay.

## Interface review

1. Reload/restart, choose Team stats, Q1, and open Choose stats.
2. Select the new metrics; check summary rows and dated log columns.
3. For current saved games, compare displayed quarter counts with a few source
   events where practical. Expand unavailable reasons when values show dashes.
4. Check that valid values remain visible when another metric is withheld, and
   sample percentages agree with combined makes/attempts in the included rows.
5. Return to Full game and Player details to confirm earlier choices/values
   remain usable. Player quarter controls should remain disabled.

Visual interactions were reviewed manually, not automated. The checkpoint is
ready for manual commit/push. No custom-layout branch has been created; start
that separate experiment after the statistics checkpoint is saved remotely.
