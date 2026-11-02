# Defender matchup milestone

Implemented November 1, 2026. Sources are public archived NBA Stats JSON and
SportsDataverse schedule/player-ID crosswalk release files. No new dependency.

## Verification

- ESPN game `401704627` maps uniquely to NBA game `0022400061`, BOS at home
  against NYK on October 22, 2024, final score 132–109, ending season 2025.
- ESPN Jayson Tatum `4065648` maps to NBA `1628369` with crosswalk confidence
  1.0; the NBA home player ID and name match. Nested defenders appear on the
  opposing NBA roster. The nba_api parser documents outer players as `Off`
  and nested players as `Def`:
  https://github.com/swar/nba_api/blob/master/src/nba_api/stats/endpoints/_parsers/boxscorematchupsv3.py
- Read directly from the raw JSON: Mikal Bridges has the longest precise time,
  361.6 seconds (displayed upstream as 6:02), 10 Tatum points, 4/4 FG, 2/2 3PT,
  4 assists and 0 turnovers/blocks. OG Anunoby has 1 turnover; Jericho Sims has
  1 matchup block. Counts are displayed as reported, not reconciled with ESPN
  player totals: tracking assignments are a different attribution system.
- Live local API request returned these values after fetching the real releases
  and archive. Recent ESPN game `401909285`, Luka Doncic `3945274`, maps to NBA
  `0022600023` but has empty tracking arrays: the API returns unavailable.
- Automated tests cover populated/empty records, ID/name/team mismatches,
  ambiguous mapping, precise-time sorting, ties, null metrics, caching, refresh,
  404s and invalid request inputs. All 23 project tests pass outside the Windows
  sandbox; its restrictions block the existing ESPN atomic-rename test.

## Fixture provenance

`server/fixtures/nba-matchups-0022400061.json` and
`server/fixtures/nba-matchups-0022600023.json` were downloaded without changing
their values from these URLs (JSON whitespace compacted):

- https://raw.githubusercontent.com/sportsdataverse/hoopR-nba-stats-raw/main/nba_stats/json/boxscorematchupsv3/2025/0022400061.json
- https://raw.githubusercontent.com/sportsdataverse/hoopR-nba-stats-raw/main/nba_stats/json/boxscorematchupsv3/2027/0022600023.json

Archive attribution/license: https://github.com/sportsdataverse/hoopR-nba-stats-raw

Schedules and crosswalks:
https://github.com/sportsdataverse/sportsdataverse-data/releases

## Limits

This is not live tracking. Archive publication and coverage vary. Unverified
names (including alternate spellings), conflicting IDs or missing opposing
roster entries are withheld. Highest matchup time is not a judgment about
defensive quality. No player quarters or prediction model is implemented here.
