# SportsDataverse NBA Stats period investigation

Reviewed October 31, 2026. The application was not changed.

## Result

**Useful source, but the inspected `boxscoretraditionalv3_period` files are
period-start lineup snapshots, not complete quarter box scores.** They cannot
directly supply the quarter averages we want. The full-game releases remain
useful for historical imports and cross-source checks.

An initial reading of the folder name suggested full-quarter totals. Actual
values did not reconcile, so the producer implementation was inspected. It
intentionally requests a one-second custom window at each period's opening
tick, to identify who starts the period. Zero scoring in those windows is not
evidence of a broken archive; treating those records as quarter totals would
be our interpretation error.

Primary implementation explaining the purpose:
[shared period-window code](https://github.com/sportsdataverse/sportsdataverse-py/blob/main/sportsdataverse/scrape/stats/periods.py).
The [capture stage](https://github.com/sportsdataverse/hoopR-nba-stats-raw/blob/main/python/nba_stats_03_period_boxscores.py)
uses this window calculation, captures overtime periods when found in the
game's play-by-play, and skips games without the required play-by-play.

## Actual downloads and checks

Three published full-game team CSVs were read, along with four per-game period
files and their archived full-game box scores. Only the four small period files
were retained; no dependency, account or application setting was added.

| Season ending year | Team CSV rows | Distinct games | Quarter column? | Asset update UTC |
| --- | ---: | ---: | --- | --- |
| 2024 (2023–24) | 2,638 | 1,319 | No | 2026-09-30 23:34:57 |
| 2025 (2024–25) | 2,642 | 1,321 | No | 2026-10-01 00:30:43 |
| 2027 (2026–27) | 162 | 81 | No | 2026-10-31 12:51:41 |

These are row counts, not completeness guarantees or counts restricted to
regular-season games. The files carry season-type IDs, which an importer must
filter explicitly. The 2027 period folder returned 81 files in its directory
listing. Older directory listings can hit GitHub's 1,000-entry limit and were
not used to claim a full count.

The current-season asset is newer than the descriptive release-page prose,
which still listed coverage through 2026. Therefore **2026–27 full-game data is
available in the asset actually checked**, despite that older description.
This is a periodically published archive, not a live-update guarantee.

## Four concrete examples

| NBA game ID | Example | Period keys present | Whole-game points | Sum of snapshot points |
| --- | --- | --- | --- | --- |
| 0022400061 | Boston–New York, Oct 22, 2024 | 1–4 | BOS 132 / NYK 109 | 0 / 0 |
| 0022600023 | Golden State–Lakers, Oct 30, 2026 | 1–4 | GSW 112 / LAL 95 | 0 / 0 |
| 0022301167 | Boston–New York, Apr 11, 2024 | 1–4 | BOS 109 / NYK 118 | 0 / 0 |
| 0022400002 | Detroit–Miami, overtime example | 1–5 | DET 123 / MIA 121 | 0 / 0 |

For the first two examples, snapshot points also failed comparison with the
independently retrieved ESPN quarter scores saved earlier. For example:

- Boston's real Q1 was 43 points; the snapshot has 0.
- Golden State's real Q1 was 15 points; the snapshot has 0.

Player records contain the desired field names (minutes, points, assists,
offensive/defensive rebounds and blocks), but within the same tiny capture
window. None of the 90 players recorded as playing in the four full-game boxes
had snapshot minutes that summed to their full-game minutes. Incidental zero
point matches for scoreless players do not validate quarter statistics.

## Implications for our app

1. **Historical full-game data:** promising. The Boston–New York full-game
   record matches our ESPN example for points, assists, both rebound types and
   blocks. Match games using teams/date or a verified crosswalk, because ESPN
   and NBA game/player IDs are different.
2. **Team/player quarter counts:** not supplied by these particular snapshots.
   Continue evaluating full play-by-play or another genuinely full-period feed.
   Do not enable zero-valued quarter displays from these files.
3. **Player quarter minutes:** these snapshots may help identify period starters,
   which can be combined with substitutions to reconstruct time played. That
   requires separate ID matching and validation; snapshot minutes themselves
   are not the player's quarter minutes.
4. **Source transparency:** preserve upstream provider, downloaded-at time,
   season convention and whether values are official totals or derived counts.

Recommended next milestone: validate the free play-by-play route on a bounded
sample, with a check of NBA Stats archived events as a possible comparison
source. Do not attempt to fix upstream code or subscribe to a provider as part
of this investigation. No upstream messages or issues were sent.

## Evidence and reproduction

- `sdv-period-validation.json`: URLs, exact fields, comparisons, player checks
  and asset timestamps. `validTeamTotals: false` means **unsuitable as full-quarter
  totals**, not a claim that the intended lineup snapshots are corrupt.
- `sdv-period-samples/`: four exact downloaded period JSON records (~179 KB).
- `inspect-sdv-periods.mjs`: repeatable inspection; requires Node and internet.

```powershell
node research/inspect-sdv-periods.mjs
```

Source assets:
[team box-score release](https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/nba_stats_team_boxscores),
[period archive](https://github.com/sportsdataverse/hoopR-nba-stats-raw/tree/main/nba_stats/json/boxscoretraditionalv3_period),
[repository license](https://github.com/sportsdataverse/hoopR-nba-stats-data/blob/main/LICENSE.md).

The repository states CC BY 4.0. Any integration should retain appropriate
attribution and distinguish that repository license from upstream data rights.
