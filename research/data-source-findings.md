# Real NBA data investigation

Reviewed October 31, 2026. The React app is still the original
demo. Only this research folder was added during this milestone.

## Recommendation

Use the ESPN public site feed for the next small **local prototype** milestone:
full-game team/player logs and team quarter points. It returned useful current
and historical data without a key or subscription in the requests below.
This is a technical recommendation for experimentation, not a claim that ESPN
offers a supported developer contract, guaranteed availability, or redistribution
permission. Its public-sharing usage terms have not been validated here.

Keep the provider behind a small Node data service so it can be replaced. Do
not subscribe to a paid source until its required quarter coverage has been
tested with an authorized key. No account or subscription was created.

## What was actually tested

| Request | Outcome |
| --- | --- |
| NBA CDN box score, game `0022400061` | Access Denied (HTTP 403) |
| NBA Stats `boxscoretraditionalv3`, same game, Q1 | Timed out after 15 seconds |
| ESPN scoreboard, `20241022` | Two completed games returned |
| ESPN scoreboard, `20261030` | Ten games returned, including Lakers–Warriors |
| ESPN scoreboard with hyphenated date ranges | HTTP 400; not suitable as used |
| ESPN Lakers schedule, season `2027`, regular season | 80 events returned; NOT a claim of an exhaustive 82-game schedule |
| ESPN game summaries for the last three completed Lakers games | Full-game team stats, player stats and minutes, team quarter scores returned |
| ESPN summary for Boston–New York, October 22, 2024 | Historical team/player box data and quarter scores returned |

NBA failures describe these requests from this computer; they do not establish
that every NBA endpoint is unavailable everywhere. No attempts were made to
bypass the CDN denial. NBA's [statistics-use restrictions](https://www.nba.com/termsofuse)
also need attention before relying on its data for a shared, regularly updated service.

The repeatable evidence is in `verified-samples.json`. Run this from the project
folder to refresh the small sample (PowerShell, five requests):

```powershell
.\research\inspect-nba-data.ps1
```

The default research date is deliberately fixed at October 31, 2026. For another
date pass `-AsOf YYYY-MM-DD`. The date cutoff uses a fixed UTC−3 offset for this
specific October investigation; it is not a general daylight-saving-aware app
implementation. NBA schedule dates in the output use Eastern Time, with original
UTC timestamps retained. The script stops on request failures instead of reusing
an earlier response. It checks that period points sum to the final score for all
eight team records in its four game summaries.

## Verified examples

ESPN's October 30 Lakers–Warriors summary returned:

| Team | Q1 | Q2 | Q3 | Q4 | Final | AST | OREB | DREB | BLK |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warriors | 15 | 38 | 32 | 27 | 112 | 31 | 15 | 29 | 5 |
| Lakers | 38 | 15 | 27 | 15 | 95 | 18 | 16 | 29 | 11 |

AST/OREB/DREB/BLK above are **full-game totals**, not quarter totals.

| Luka Doncic appearance | Opponent | MIN as supplied | PTS | AST | OREB | DREB | BLK |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| October 30, 2026 | Warriors | 37 | 37 | 5 | 1 | 6 | 2 |
| October 27, 2026 | Trail Blazers | 37 | 41 | 9 | 0 | 5 | 1 |

The October 28 Clippers summary did not contain this player's record. We cannot
infer why from absence alone. This exposes an important rule: **last N team
games differs from last N player appearances**. The app must continue looking
back for player appearances and distinguish unavailable records from zero stats.
This research sampled three team games, not three player appearances.

## Source comparison

| Source | Verified / documented capabilities | Cost and access | Limitations for this project |
| --- | --- | --- | --- |
| ESPN public site feed | Tested full-game team/player metrics, minutes, quarter team points, dates and opponents | Tested without a key or fee | Quarter non-point metrics/player minutes not verified; no established public developer SLA or redistribution permission here |
| NBA website feeds via `nba_api` | Community client documents period box scores and historical filters | Test URLs needed no key | CDN denial and stats timeout here; client code licensing does not license the data |
| BALLDONTLIE | Documents player game logs with `period=1..4` for completed games | Free tier excludes player game stats; ALL-STAR $9.99 USD/month, 60 requests/min; GOAT $39.99, 600/min | No key available, so documentation only; per-period history/completeness and team aggregation need sample validation |
| API-Sports API-NBA/API-Basketball | Documented team/player box stats; API-Basketball includes quarter scores | Advertises a free 100 requests/day; account/key required | Not request-tested; free-season access and detailed non-point quarter coverage not established |

BALLDONTLIE documents game history from 1946 onward, but that does not establish
the same history for every per-period field. Its terms permit app use and caching,
subject to restrictions; API keys must not be distributed to friends. A backend
would keep the key out of browser code. Team aggregate definitions must also be
checked: team rebounds are not always the sum of individual player rebounds.

## What remains unverified

- Team quarter AST, OREB, DREB and BLK; player quarter stats and minutes.
- Multi-season completeness and playoff/play-in handling across providers.
- Historical roster coverage, trades, missing records, corrections and DNPs.
- Availability under repeated daily use, request limits, and data freshness.
- Permission for publishing the final shared app with the selected data source.

ESPN includes play-by-play. Reconstructing period metrics from it is a separate
validation task, particularly assists, blocks, team rebounds and substitutions.
Do not treat its presence as proof that a simple text parser will be accurate.

## Proposed next milestone — requires review and approval

Connect the existing four demo teams to real **completed regular-season games**
using a small Node service, while preserving `npm run dev` as the launch command.

1. Map stable provider team/player IDs into the app's internal format.
2. Retrieve schedules and game summaries; skip unfinished games. Cache successful
   responses (reuse downloaded results) with fetch timestamps and a refresh path.
   Make provider failures visible; never silently fall back to fictional data.
3. Show full-game team and player logs with actual dates, minutes and sample counts.
   Define player N as appearances, and keep scanning within an explicit season
   bound. Label short samples instead of claiming cross-season completeness.
4. Allow team quarter points. Mark other quarter metrics and player quarter views
   unavailable until validated. Store full-game totals separately from periods
   so overtime and missing periods cannot corrupt full-game numbers.
5. Verify a known historical game and a current completed game against their
   provider records, plus missing/DNP, unavailable-field, and request-failure cases.

This would be a small real-data integration, not yet predictions, public sharing,
all 30 teams, or an exhaustive historical importer. If complete quarter metrics
are the priority over staying key-free, first validate a paid provider instead.

## References

- [SportsDataverse NBA tutorial](https://py.sportsdataverse.org/docs/tutorials/nba_intro): ESPN schedules, summaries and player-log access patterns.
- [hoopR ESPN client source](https://github.com/sportsdataverse/hoopR/blob/master/R/espn_nba_data.R): independent open-source client for the same summary/scoreboard routes.
- [nba_api period box-score documentation](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoretraditionalv3.md).
- [BALLDONTLIE documentation and pricing](https://docs.balldontlie.io/).
- [BALLDONTLIE usage terms](https://www.balldontlie.io/terms.html).
- [API-Sports NBA access plans](https://api-sports.io/sports/nba).
- [API-Sports basketball schema](https://api-sports.io/documentation/basketball/basketball-v1.yaml).
- Each saved game sample records its exact ESPN request URL for provenance.
