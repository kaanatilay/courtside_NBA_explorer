# Team quarter comparison — completed milestone

The app now displays team quarter points, assists, offensive rebounds,
defensive rebounds and blocks. Player quarter stats/minutes are still unavailable.
No paid source, account or new dependency was added.

## Where the numbers come from

- Points: ESPN's published period scores, checked against the final score.
- Other quarter metrics: counts calculated from ESPN's final play-by-play.
- Full-game values: ESPN's box score, retained independently (including OT).
- All averages retain the selected game sample. A missing/failed metric in any
  selected game makes that metric's average unavailable, rather than dropping
  that game or substituting zero.

`server/quarters.js` counts scoring and assisted-shot events, offensive/defensive
rebound events with player attribution, and blocks recorded on the shooter's
missed shot. It checks that the blocker belongs to the opposing team. Team and
dead-ball rebound events are excluded to match the credited-player rebound
counts used by ESPN's OREB/DREB box-score fields in the tested games.

## Runtime checks

- Period numbers, clock bounds, event IDs, sequence IDs and participant shapes.
- Identical duplicate IDs are removed; conflicting duplicates are rejected.
- A period-ending record is present for each period in the score breakdown.
- All scoring plays sum to the published points in each period for both teams.
- The sum across all periods, including OT, matches each team's full-game AST,
  OREB, DREB and BLK. Missing box-score totals do not count as zero.
- Ambiguous player/team roles or a metric mismatch withhold the affected metric.
  Structural/scoring failures withhold all four calculated metrics. Published
  period points and full-game values remain available independently.

Final ESPN feeds sometimes insert corrections out of chronological arrival
order. For example, Portland's made dunk `401909880558` arrived after Q4 had
started but explicitly belongs to Q3 at 0:00. The parser uses the explicit
period instead of sequence position; regression checks cover this case.

The interface labels derived stats and shows how many games passed checks.
When a metric is unavailable, expandable explanations beneath each table list
the date, metric and reason. Player quarter controls remain disabled.

## Offline evidence

Four reduced real-game fixtures retain relevant headers, box scores and plays,
without articles, media, odds or injury reports:

| ESPN game | Matchup/date | Periods | Recorded plays |
| --- | --- | ---: | ---: |
| 401704627 | Boston–New York, Oct 22, 2024 | 4 | 390 |
| 401909285 | Golden State–Lakers, Oct 30, 2026 | 4 | 518 |
| 401909880 | Lakers–Portland, Oct 27, 2026 | 4 | 511 |
| 401703371 | Detroit–Miami, Nov 12, 2024 | 5 | 507 |

Each fixture records its original ESPN URL and capture time. The fourth game
was selected to cover overtime and technical free throws. The fixtures also
include reviews, late events and team rebounds.

For every fixture, 32 derived full-game metric comparisons and 34 period-point
comparisons pass in total. Six team-period examples (30 values) were manually
tallied from event descriptions, with their contributing event IDs preserved in
`server/fixtures/manual-quarter-checks.json`:

| Game/period | Team | PTS | AST | OREB | DREB | BLK |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Boston–New York Q1 | BOS | 43 | 11 | 3 | 10 | 0 |
| Boston–New York Q1 | NYK | 24 | 4 | 1 | 6 | 1 |
| Golden State–Lakers Q1 | GSW | 15 | 5 | 3 | 4 | 0 |
| Golden State–Lakers Q1 | LAL | 38 | 10 | 3 | 10 | 4 |
| Detroit–Miami OT1 | DET | 12 | 2 | 0 | 4 | 2 |
| Detroit–Miami OT1 | MIA | 10 | 2 | 3 | 2 | 0 |

The manual checks are independent of the counting implementation, but use the
same underlying ESPN event feed. They are not independent official quarter box
scores and do not establish correctness for every game or historical season.

## Automated and browser validation

`npm test` includes checks for the saved game totals/manual period expectations,
OT separation, corrected period assignment, exact/conflicting duplicates, wrong
scoring periods, missing events/endings, invalid clocks, ambiguous blocks,
missing box-score values, and propagation of unavailable values to averages.
The cache schema changed so earlier normalized results are re-fetched.

The live local API reproduced the manually checked Lakers Q1 example. Browser
checks cover current comparisons, historical opponent filters, quarter switching,
and the retained full-game player view. Build validation uses `npm run build`.

## Practical limits

These are derived counts, not a newly licensed official period-box-score feed.
The checks can detect many gaps and discrepancies but cannot detect every
possible source error that happens to preserve all totals. Only the selected
regular season is scanned; there is no new cross-season, live-game or prediction
feature in this milestone. Prefer Refresh data when checking a provider correction.
