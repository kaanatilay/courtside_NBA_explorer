# Data-source validation and register

Reviewed November 1, 2026. Research milestone only; no application behavior changed.

## Decision for review

Retain ESPN as the core on-demand provider and the SportsDataverse NBA matchup archive as a specialized historical source. No redundant active provider was identified. Do not add another general box-score provider merely to expose fields ESPN already supplies. Player quarter data remains an unresolved collection requirement, not an approved implementation.

NBA.com is authoritative but its tested direct quarter requests remain inaccessible here. StatMuse's official API is a conditional candidate requiring paid access and a separate sample test; do not subscribe on the strength of this report. RealGM is a secondary reference. Defer Hoopsgraph as a data provider and set aside The Stats Don't Lie for this milestone. Basketball Reference is a human reference rather than a collection dependency.

## Repeatable access and field checks

`node research/source-validation.mjs` makes seven bounded public requests, writes `source-validation-results.json`, and does not change application files, caches, or credentials. Downloaded JSON is parsed as data, never executed. It samples the first two player rows per team/group rather than retaining complete new game records. Existing complete fixtures remain separately labeled. An initial sandbox run failed DNS resolution; the approved run outside that network restriction produced these results:

| Request | Result |
| --- | --- |
| ESPN BOS–NYK, October 22, 2024, 401704627 | HTTP 200; BOS 132–109; four periods |
| ESPN GSW–LAL, October 30, 2026, 401909285 | HTTP 200; GSW 112–95; four periods |
| ESPN DET–MIA, November 12, 2024 Eastern, 401703371 | HTTP 200; DET 123–121; five periods including OT |
| NBA traditional v3 Q1, historical 0022400061 | Timed out with 18-second request limit |
| NBA traditional v3 Q1, recent 0022600023 | Timed out with 18-second request limit |
| Repeat historical ESPN request | HTTP 200; identical summarized response |
| SportsDataverse NBA historical matchup JSON, 0022400061 | HTTP 200; 11 home / 12 away outer player records |

Verification after downloading: all six ESPN team period-point sums equal final scores; all three games' team scores/periods and sampled player identities/stat values match saved fixtures; the historical repeat summary is identical; overtime is represented by a fifth period. These are consistency checks, not independent validation of ESPN's original attributions, complete rosters, or season coverage. No successful NBA direct quarter response was available to compare with ESPN, and no authenticated StatMuse query was made. Cross-provider player-quarter reconciliation therefore could not be completed.

The NBA requests use the public traditional-v3 parameters documented by the [nba_api project](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/boxscoretraditionalv3.md). Two failures do not prove every NBA endpoint is unavailable. No denial was bypassed.

## Useful data already inside ESPN responses

Across the three live samples, player box-score labels include MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF and +/-. The app currently normalizes only minutes, points, assists, offensive/defensive rebounds and blocks. Shooting is supplied as makes/attempts strings, so future implementation must parse and validate those rather than treating them as single numbers.

Team responses also contain shooting percentages and makes/attempts, steals, turnovers, fouls, points off turnovers, fast-break points, points in the paint and largest lead. Some additional fields vary by game. Their presence in three records is not proof of universal coverage. These are full-game fields, not quarter counts. Team line scores supply period points. No player `linescores` arrays were observed in the sampled box-score structure; this narrow observation does not establish the absence of every possible ESPN period endpoint. Play-by-play contains participant/period/clock data but player counting attribution and minutes need separate validation.

## Source register

| Source | Purpose / incremental value | Access evidence | Collection decision |
| --- | --- | --- | --- |
| ESPN public website feeds | Core schedules, game/player logs, team period points, play-by-play; additional undisplayed full-game fields | Three game downloads plus one repeat succeeded without a key | Retain; on-demand updates; no complete-season or service guarantee established |
| SportsDataverse NBA Stats archive | Historical defender tracking, distinct from our ESPN integration | Historical matchup file downloaded; prior fixtures include empty recent tracking | Retain specialized archive; not a live source or quarter-total substitute |
| NBA.com Stats | Official quarter-level and richer statistics candidate | Page has quarter controls; both direct Q1 requests timed out | Keep on research shortlist; do not make app depend on unproven retrieval |
| StatMuse | Observed public player-quarter counts; possible structured official access | Website quarter rows observed previously, minutes blank in sample; official API documentation inspected only | Conditional shortlist; paid authenticated sample required before adoption |
| RealGM | Readable season tables and secondary checks | Public table read during screening | Reference only; unique quarter contribution and supported collection interface unestablished |
| Basketball Reference | Historical context and season totals | Specific 2026 totals URL returned 403 during screening | Manual reference; exclude from automated collection plan |
| The Stats Don't Lie | Team quarter points scored/allowed summaries | Descriptions accessible; numerical tables not retrieved in screening | Set aside: overlaps existing scoring and adds no established missing player fields |
| Hoopsgraph | Trends, injury context and prediction presentation | Public pages and self-reported methodology read | Design/research reference; data export, ownership transparency, and prediction accuracy not independently validated |

Different websites may share upstream NBA/ESPN records; agreement between them is not automatically independent corroboration. Avoid adding SportsDataverse ESPN mirrors as a second independent source. Its NBA archives are a different, useful category. The previously inspected `boxscoretraditionalv3_period` files are one-second period-start lineup snapshots, not complete quarter totals; see `sdv-period-findings.md`.

## StatMuse access findings (documentation, not authenticated results)

- [Official portal](https://developer.statmuse.com/) describes an API/MCP beta included with StatMuse+, restricted to personal, noncommercial use. MCP connects an assistant to service tools; REST lets our backend request structured responses directly.
- [Get started](https://developer.statmuse.com/get-started) displayed $20/month, but the plan component reported that plans could not load. Currency, final checkout price and included numerical quota were not verified. No account, purchase, key, or connection was created.
- [Question API](https://developer.statmuse.com/docs/asking-questions) accepts natural-language questions up to 200 characters. Structured stat values may be null; some responses contain only text. We would need to verify player/game/period identity and not assume a successful HTTP response means usable data.
- [Limits documentation](https://developer.statmuse.com/docs/rate-limits) describes a default five-token-per-second limiter and account-specific billing-period quotas shared between REST and MCP. The 10,000 quota shown in examples is not a verified included allowance. Certain processed query errors also consume quota.
- Exact quarter history, minute precision, complete result retrieval/pagination and freshness were not established by authenticated requests. Public quarter examples do not prove equivalent API coverage. Do not scrape search pages as a substitute for official access; [website terms](https://www.statmuse.com/terms) impose collection/reuse restrictions.

## Reference and trust findings

- [NBA scoring page](https://www.nba.com/stats/players/boxscores-scoring): official league source; authority does not guarantee access or perfect attribution. Its scoring view is not automatically the traditional count table we need.
- [RealGM](https://basketball.realgm.com/nba/stats) and [company information](https://basketball.realgm.com/info/): identifiable operator and readable tables; this screening does not establish data permissions or independent accuracy.
- [Sports Reference access policy](https://www.sports-reference.com/bot-traffic.html) explains rate limiting and lack of an API; [data-use policy](https://www.sports-reference.com/data_use.html) should be consulted before any reuse. Export controls are not blanket permission to power an app.
- [The Stats Don't Lie about page](https://www.thestatsdontlie.com/about/) says statistics are internally collated; underlying NBA supplier/correction process was not established. [Quarter page](https://www.thestatsdontlie.com/nba/points-by-quarter/) mostly overlaps our existing team scoring.
- [Hoopsgraph](https://hoopsgraph.com/) identifies NBA box scores and [publishes methodology](https://hoopsgraph.com/methodology). Claimed prediction scores are self-reported, not independently reproduced. No supported public export/API was established. This is a reason to defer it as a provider, not a claim of maliciousness.
- No malware scan or security certification was performed for any site. A reputation service's unknown label is inconclusive. Reading public pages successfully does not certify their scripts, advertising or downloads as safe.

## Proposed collection design, not implemented

The collection design uses manual refresh and durable saved completed-game records with source URL, provider IDs, game date, fetch timestamp and explicit missing-field states. Updates run on demand, with visible errors and a clear distinction between last-saved data and a successful new fetch. Expiring caches alone are not a durable historical collection. On-demand refresh cannot recover missing historical tracking or historical injury states never captured by the provider.

Before building storage, review this register and agree required datasets, history scope and acceptable missing coverage. Player quarter counts and minutes remain unvalidated. Defender attribution inconsistencies documented in PROJECT_HANDOFF.md remain unresolved; do not use matchup row sums as player totals or prediction training targets.
