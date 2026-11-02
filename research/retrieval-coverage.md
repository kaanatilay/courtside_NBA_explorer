# Retrieval coverage audit

Update, November 2, 2026: the classification milestone below has now been
implemented. The original audit findings remain as historical evidence.
Regular-season provider requests verify per-event season/type and exclude Cup
finals. Schedule rows retain seasonYear, seasonType and competitionClass.
Legacy SQLite schedule snapshots and file caches are invalidated for schedule
reuse; the next successful request replaces the snapshot without deleting games.
Unclassified completed events fail visibly. Classified saved schedules can
still be used with a warning if a refresh fails.

Verification: all 28 tests passed; production build passed. New saved-example
tests cover both observed Cup finals, a controlled semifinal, wrong year/type,
missing metadata, legacy schedule replacement and failed-refresh preservation.
Replaying the saved all-team audit through the new normalizer produced 82 games
for each of the 60 historical team-season combinations. This replay uses real
event metadata with controlled competitor IDs, not fresh network downloads.
No browser checks or new external requests were made for this fix. Cup-final
recognition relies on provider notes; a final missing or changing those notes
is a remaining limitation. Play-in classification and playoff 404 diagnosis
remain separate, unimplemented follow-ups.

November 2, 2026. Evaluation scope: all 30 teams,
2024–25, 2025–26 and current 2026–27; regular season and playoffs, with play-in
separate. No application code or database records changed during this audit.

## Conclusion

The core retrieval system is usable with limitations, not complete. ESPN is a
practical core source for on-demand full-game records and checked team quarters.
Two concrete retrieval gaps require attention before broadening the app: exclude
NBA Cup championship statistics from regular-season samples, and handle/diagnose
a completed playoff schedule entry whose summary returns 404. Player quarter
counts/minutes, play-in discovery, fresh defender coverage, injury/context feeds
and independent historical completeness remain unresolved.

## Requirements and readiness

| Requirement | Evidence / source | Result |
| --- | --- | --- |
| All-team identity discovery | ESPN league inventory returned 30 teams | Ready as source discovery; app catalog remains four teams |
| Three-season regular schedules | All 90 requests succeeded; event-level metadata and Cup exceptions examined | Usable with classification fix; no independent exact-ID completeness audit |
| Playoff schedules | All 90 requests succeeded; historical completed events returned, current postseason empty | Source usable; UI/API currently regular-season only |
| Play-in kept separate | Not explicitly identified in returned regular/postseason event notes | Unresolved; absence is not proof no other endpoint supplies it |
| Full-game player/team PTS, AST, OREB, DREB, BLK and player minutes | 24 successful game samples; no missing core values among recorded appearances | Usable with limitations; one sampled playoff game returned 404 |
| All players, not just selected stars | Successful records contain participant rows and DNP records | Usable; no independent check that every participant was supplied |
| Additional shooting/STL/TO/PF fields | Prior source audit found them in ESPN responses | Available but not yet exposed/normalized as app metrics; not exhaustive coverage-tested here |
| Team quarters | All 48 successful team records passed existing parser checks | Usable with checks; source attribution not independently proven |
| Player quarter counts | No validated provider/reconstruction | Unresolved; NBA requests timed out previously, StatMuse unauthenticated |
| Player quarter minutes | No validated period minutes | Unresolved; separate lineup/substitution validation needed |
| Defender matchup history | Specialized SportsDataverse NBA archive | Usable with missing coverage/attribution limitations; latest availability not re-audited here |
| Injury, lineup availability and other explanatory context | No integrated validated source | Unresolved future requirements |
| Durable on-demand collection | SQLite/service tests and user interface review from preceding milestone | Ready for current scope; bulk performance, backups and migrations untested |
| Manual refresh and corrections | Existing integration tests; unique provider/game keys | Ready for current scope; no revision history or older-timestamp guard |
| Public distribution | Upstream permissions not established | Unresolved before publishing |

No source subscription or alternative provider was added. StatMuse remains a
conditional official-access candidate, not a proven source; the other screened
sites do not resolve the demonstrated gaps based on evidence currently obtained.

## What was actually requested

`coverage-audit.mjs` requested the ESPN team inventory, 180 team/season/type
schedules (30 × 3 × 2), and 25 distinct completed game summaries. Detailed game
selection used the latest completed returned event in each available bucket
for six division representatives: ATL, BOS, CHI, DEN, LAL and SA. Opponents add
other teams, but this is not all-game or all-team box-score validation.

Evidence is retained in `coverage-audit-results.json` (event IDs, dates, labels,
notes and metric checks) and compact `coverage-audit-summary.json`. Raw game
responses were not saved by this audit. No stale cache was used. The initial
sandbox-only run failed DNS; the explicitly approved network run succeeded.

### Schedule classification and completeness

- 2024–25 regular-season requests returned 1,236 unique events, of which 1,231
  were marked completed. One completed event is the Cup final, ID 401734908.
- 2025–26 regular-season requests returned 1,235 unique events, of which 1,231
  were completed. One is the Cup final, ID 401809839.
- Excluding each Cup final gives 1,230 completed regular-season games. Each
  historical team has 82 completed entries after that exclusion. This is strong
  internal consistency, not an exact-ID comparison to an independent schedule.
- The current season returned 1,200 unique scheduled events and 92 completed
  events. The cutoff used was November 3 at 00:00 UTC, with only events already
  marked completed at request time. Counts can change after this audit. An
  initially 80-game team schedule is not by itself evidence of missing finals.
- Historical postseason requests returned 84 and 85 unique completed games.
  These totals were not independently reconciled against official brackets.
- Top-level schedule `season` metadata can describe 2026–27 even when historical
  events are returned. Per-event season/type labels should be validated; do not
  use that top-level label to assign historical records.

The NBA explicitly excludes its Cup championship from the regular-season
standings; see [NBA Cup FAQ](https://www.nba.com/news/nba-cup-frequently-asked-questions).
ESPN labels those events with seasonType 2, so simply requesting `seasontype=2`
and selecting completed games is insufficient. This affects the current app's
regular-season promise. It is a finding here, not yet an implemented fix.

### Game records and checks

24 of 25 sampled summary requests succeeded. All 48 successful team records
contained the core team metrics. Every recorded player marked as having played
had the six normalized fields (MIN, PTS, AST, OREB, DREB, BLK). Existing team
quarter validation reported checked for all 48 team records. Agreement does not
prove independent attribution accuracy or that absent players were correctly
omitted. Some historical samples include overtime; prior dedicated fixtures
remain the stronger controlled overtime tests.

ESPN game 401869402 (Denver at Minnesota, May 1, 2026 UTC) was marked completed
in Denver's 2025–26 postseason schedule but `/summary?event=401869402` returned
HTTP 404. Its cause is unestablished; do not call this a permanent loss or silently
substitute another game. The current service would fail a first-time sample if
it needs that unavailable game, preserving a visible gap instead of shortening
the sample without explanation.

### Retrieval efficiency

Schedule response-header timings were about 150–408 ms, median about 186 ms,
in this run with two workers. These timings were captured before JSON body
parsing and are not end-to-end UI timings or service guarantees. The audit is
not a rate-limit, load or SQLite scale benchmark.

The production service scans games sequentially to find a player's last N
appearances; long scans can be expensive on first use. Saved reads re-normalize
raw responses, including quarter derivation, rather than using only indexed
normalized rows. That is a measurable optimization candidate, not a reason to
rewrite before profiling. A refresh updates only the selected schedules and
scanned games, not the whole collection. The database does not currently index
season/competition type as explicit game columns; expansion needs those fields
and safe schema migrations, rather than relying only on raw JSON/date bounds.

## Recommended next milestone for approval

Address retrieval classification first: preserve event-level season and
competition identity, exclude Cup finals from regular-season statistics, and
test those rules with saved examples. Keep current UI selection scope for that
small fix. Then separately investigate play-in discovery and the playoff 404
before implementing all-team/playoff controls. Player-quarter source selection
remains a separate unresolved data requirement; storage work has not solved it.
