# Quarter-stat options

Milestone update: team quarter counts are now implemented with runtime checks
and unavailable-value explanations. See [team-quarter-validation.md](team-quarter-validation.md).
The sections below preserve the earlier investigation and proposed work.

Updated October 31, 2026. Team quarter points are now connected to the app.
The other period metrics below remain research, not released app features.

Follow-up: direct inspection of SportsDataverse's NBA Stats period archive found
that its `boxscoretraditionalv3_period` records are intentionally one-second
period-start lineup snapshots, not complete quarter box scores. They may help
with starter identification, but cannot supply full-period totals directly.
See [the verified archive findings](sdv-period-findings.md) before using them.

## Options and recommendation

| Route | What it could provide | Tradeoff / evidence |
| --- | --- | --- |
| ESPN play-by-play reconstruction | Count team/player points, assists, offensive/defensive rebounds and blocks by event period | Key-free requests worked. Needs our own parser, correction handling and extensive validation. Player minutes additionally require accurate starting lineups/substitutions. |
| BALLDONTLIE period player stats | Direct per-game player stats using `period=1..4` for completed games; full game `0`, overtime `5+` | Documented, not authenticated/tested here. ALL-STAR is $9.99 USD/month; do not assume historical quarter completeness. Team rebound definitions need checking before aggregating player rows. |
| NBA Stats period box scores | Direct team/player period metrics, including minutes | `nba_api` documents StartPeriod/EndPeriod; earlier local request timed out and the separate CDN returned Access Denied. Not a dependable baseline for this prototype as tested. |

Recommend a **bounded free play-by-play validation milestone** before paying for
another source. It would focus on team Q1–Q4 counting stats, with a clearly
labelled derived-data status. Player minutes are a separate, harder task and
should follow after counts are sound. If avoiding parser maintenance matters
more than cost, test BALLDONTLIE with an authorized account instead.

## What the experiment proved

Run `node research/quarter-feasibility.mjs` to reproduce. The script makes three
read-only ESPN requests and writes `quarter-feasibility.json`. No API key or
subscription was used. It counts scoring, assisted shots, individual rebound
events and blocks, grouping by the event's period.

| ESPN event | Game date (ET) | Teams | Plays inspected | Team totals vs box score |
| --- | --- | --- | ---: | --- |
| 401909285 | 2026-10-30 | Warriors / Lakers | 518 | All five metrics matched for both teams |
| 401704627 | 2024-10-22 | Celtics / Knicks | 390 | All five metrics matched for both teams |
| 401909880 | 2026-10-27 | Lakers / Trail Blazers | 511 | All five metrics matched for both teams |

That is **30 matching full-game metric checks**: 3 games × 2 teams × 5 metrics.
All 24 quarter-point comparisons also matched the provider's line scores.
This establishes feasibility on these examples, not full reliability.

## What it does not prove

- Full-game agreement does not independently validate each quarter's assists,
  rebounds or blocks. We need an independent period-level benchmark.
- Individual team rebounds vs dead-ball/team rebound events require explicit
  definitions. The trial excludes rebound events without participants.
- The trial reads assist/block wording. Text formats, overturned plays, duplicate
  events and statistical corrections may differ in other games or seasons.
- No player-specific counts or minutes were validated. Matching a name in text
  is not a durable player identifier; roles must be associated with athlete IDs.
- No overtime, corrected-event or incomplete-play-feed sample was covered.
- A usable public feed is not itself a supported redistribution contract.

## Proposed next milestone, after review

1. Build a small, saved set of complete games spanning seasons, overtime,
   reviews/stat corrections and team rebounds. Save only the relevant evidence.
2. Validate participant roles and use stable IDs. De-duplicate plays and reject
   incomplete feeds rather than turning missing events into zero statistics.
3. Reconcile full-game counts AND compare independently supplied per-period
   box scores for the same games. Record any definition differences explicitly.
4. Enable only metrics that pass those checks, labelled as derived from ESPN
   play-by-play. Keep unavailable values explicit and separate from official
   provider box-score values.
5. Add player counts after validating attribution; address minute reconstruction
   separately with starting-lineup and substitution checks.

This plan is not implemented yet. The app continues to show unavailable values
for unverified quarter metrics.

## Primary references

- [BALLDONTLIE period filters, fields and pricing](https://docs.balldontlie.io/).
- [nba_api period box-score documentation](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoretraditionalv3.md).
- [SportsDataverse ESPN access documentation](https://py.sportsdataverse.org/docs/tutorials/nba_intro).
- Each experimental result includes its exact ESPN summary URL.
