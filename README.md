# Courtside — NBA Explorer

A local React prototype for exploring **real completed-game ESPN data**.
All 30 teams are selectable in the horizontal band above the comparison.
No API key or paid subscription is needed for the current integration.

## Share or run a fresh copy

Install Node.js 24, then open a terminal where you want the project:

```powershell
git clone https://github.com/kaanatilay/courtside_NBA_explorer.git
cd courtside_NBA_explorer
npm ci
npm run dev
```

Open the printed Local URL. **Refresh league data** downloads current regular-season
data into this computer's own database. Databases, caches and dependencies are
excluded from Git. This repository runs locally; it is not a hosted website.
Provider access requires internet and is not guaranteed.

Git commands run in the same project directory as npm commands:

```powershell
git status
git add <changed-files>
git commit -m "Describe your change"
git push
```

## Run from VS Code

Open this folder in VS Code and choose **Terminal → New Terminal**:

```powershell
npm install
npm run dev
```

Dependencies are already installed on this computer. `npm install` is needed
only for a fresh copy or after dependency changes. Requires Node.js 22.13+;
Node 24 is recommended and tested. Built-in SQLite may print an experimental warning.

Open the Local link printed in the terminal, normally http://127.0.0.1:5173/.
Keep the terminal running; **Ctrl+C** stops it. If an old development server is
already running, stop it before starting the updated one. A single Vite server
now hosts both the React interface and the Node data API.

## Try this milestone

Choose **Team A** or **Team B** above the team band, then select a team.
Scroll horizontally, use the left/right controls, or focus a team and use
Left/Right/Home/End keys. Both selections are marked; a team already selected
for the other slot cannot be chosen twice. Filters and results sit below the band.
See [all-team interface review](research/all-team-interface.md) for end-to-end steps.

1. Start with **All opponents**, Last 5 games, Full game. Team summaries show
   real stats, dates and actual game counts for the selected regular season.
2. Select **Against each other**. If no matchup has happened in that season,
   the app shows an empty sample, not made-up numbers. Try a past season.
3. Select **2024–25**, Boston and New York, Against each other, Last 10 games.
   A short sample is expected. Each included date links to ESPN's box score.
4. Select Q1–Q4. Team points, assists, offensive/defensive rebounds and blocks
   update for that quarter. Points use ESPN's period scores; other counts are
   calculated from play-by-play. The app labels their origin and reports checks
   beneath each table. A failed/missing metric displays **—**, not zero, and its
   sample average is withheld. Full game includes overtime; Q4 excludes it.
   In the 2024–25 Boston–New York head-to-head sample, the October 22 game’s Q1
   row should show Boston **43 PTS, 11 AST, 3 OREB, 10 DREB, 0 BLK**.
5. Open Players. The list shows real participants in the current **team sample**,
   with each player's appearance count and full-game averages for that sample.
6. Click a player. Their detail view searches further back for their own last N
   appearances with this team, season and opponent filter. It skips DNP/missing
   player records and states how many matching team games were inspected.
   It does not include appearances for other teams after/before a trade.
7. Try Lakers, All opponents, 2026–27, Last 3, then Luka Doncic. In the tested
   October 31 sample the detail scan inspected four team games to find three
   appearances. As new games happen, this exact sample will naturally change.
8. Click **Refresh league data** to update all 30 teams in the **current regular
   season**, regardless of the displayed comparison. It checks schedules, adds
   missing completed games, and re-downloads saved games played in the last seven
   days for corrections. Older saved games are reused; historical seasons and
   defender tracking are separate. Progress and failures appear in the update
   panel. Games update by unique provider/game ID, without duplicate copies.
   Ordinary viewing reuses saved records across restarts and downloads missing
   records for a first-time selection. No fictional data is used.

Player quarter controls are disabled until their data is verified. Roster list
averages and player-detail averages can differ because their samples differ;
the explanation above each view makes that explicit. Provider minute precision
is preserved: many ESPN records report rounded whole minutes.

## How the code fits together

```text
Browser selections → /api/comparison or /api/player
                   → Node service → disk cache / ESPN
                   → normalized games → React summaries and logs
```

- `src/catalog.js`: all 30 team identities, ESPN IDs and supported metrics.
- `server/normalize.js`: converts ESPN responses into a consistent internal
  format. Keeps full-game totals separate from periods and missing values null.
- `server/quarters.js`: counts team assists, credited player rebounds and blocks
  by event period. Verifies attribution, handles identical duplicate IDs, checks
  period scores and full-game totals, and returns reasons for withheld metrics.
  Late corrected events use their stated period, not their arrival order.
- `server/provider.js`: fetches ESPN with timeouts. The running app saves game
  responses and schedule snapshots in `.local-data/games.sqlite` through
  `server/store.js`. Viewing reuses saved records until explicit refresh; a
  first-time selection downloads missing records. The legacy `.data-cache/`
  mode remains for isolated callers/tests. Both directories are excluded from Git.
- `server/refresh.js`: runs one current-season league update at a time, with two
  download workers, a seven-day correction window, and progress/failure reporting.
- `server/api.js`: validates filters, selects team games, and scans player
  appearances. An upstream failure stops the result instead of concealing gaps.
- `vite.config.js`: installs the local API in both dev and build preview.
- `src/stats.js`: selects observed rows and calculates averages. If any metric
  is missing in a sample, its average is unavailable rather than guessed.
- `src/main.jsx`: controls, loading/errors, team comparisons and player details.
  Cancels superseded browser requests so old responses cannot replace new ones.
- `src/styles.css`: responsive glass styling and accessible control states.

No extra package was required for the data service: Node provides HTTP fetching,
file storage and the test runner. The optional Google Fonts stylesheet needs
internet; system fonts are used if it is unavailable.

## Checks

The [local storage prototype](research/storage-prototype.md) established the
database foundation. It is now connected to the app; see the
[saved-data integration guide](research/saved-data-integration.md) for review steps.
The button now runs a league-wide cycle; see [league refresh](research/league-refresh.md).

```powershell
npm test
npm run build
```

Tests cover overtime, missing stats, DNPs, chronological schedules, opponent
filtering, scanning for player appearances, caching/refresh, upstream failure,
manually tallied quarter examples, late corrections, duplicates and partial feeds.
They use small controlled fixtures, so they do not need internet. Windows
sandbox permissions can block atomic cache-file replacement; run them from your
normal VS Code terminal if that occurs.

`npm run build` creates `dist/`. `npm run preview` serves that build **and** the
local API using Vite. A static file host serving only `dist/` will not provide
the Node API; a future deployment will need its own backend configuration.

## Current limits

Regular-season schedule selection now verifies each completed event's season
and competition type and excludes NBA Cup championship games. Ordinary Cup
games remain eligible. Existing saved schedules need one successful download
after this update; saved games are retained. Missing event classification shows
an error rather than treating an unverified schedule as regular-season data.

- Current season plus the previous two, **regular-season games only**.
  Last N is limited to the chosen season; no hidden cross-season backfill.
- Results depend on ESPN's returned schedule and box-score completeness. A
  returned schedule may omit games; it is not an exhaustive historical archive.
- Team quarter counting stats are enabled when checks pass. Their calculations
  rely on ESPN's final event labels and box scores; agreement with totals cannot
  prove every event's original attribution is correct. Source corrections may
  change results. Player quarter stats/minutes, injuries, predictions, saved views
  and public sharing remain later work.
- The player list is the participants observed in the team sample, not a full
  active-roster directory. A missing player record does not establish an injury.
- The service is a local prototype using public website feeds, with no provider
  reliability guarantee. Public-sharing permissions remain a separate review.

## Defender matchups

**Known issue:** the latest interface review reported no matchup results. The
cause has not been diagnosed. Historical fixture tests pass, but do not establish
that current live retrieval works. Treat availability as unresolved.

In **Players**, select a player, then choose a game under **Who guarded…?**.
The new panel ranks recorded defenders by NBA matchup time and shows the
selected player's points, FG/3PT makes and attempts, assists and turnovers,
plus the defender's blocks. “Primary defender” means most recorded matchup
time, including explicit ties; it does not identify the best defender.

ESPN still supplies game logs. `server/matchups.js` maps the selected ESPN game
to the NBA schedule by season, Eastern date and home/away teams, checks scores
when supplied, and maps player IDs using the SportsDataverse crosswalk. The
player's name and team and opposing defender IDs must match the NBA game.
An ambiguous or missing mapping is shown as unavailable rather than guessed.
`server/api.js` serves this through `/api/matchups`; the React component loads
it only when a game is selected. No API key or extra install is required.

Sources: [NBA Stats JSON archive](https://github.com/sportsdataverse/hoopR-nba-stats-raw)
and [schedule/player crosswalk releases](https://github.com/sportsdataverse/sportsdataverse-data/releases).
This is archived tracking, **not a live feed**; recent games may have empty
records, older games may be missing, and updates are not guaranteed. Records
are cached locally for one hour; **Retry tracking** bypasses that cache.
Matchup assignments can overlap and differ from box-score attribution, so
do not sum the defender rows to reconstruct the player's game totals.

Manual check: choose BOS / NYK, 2024–25, Against each other, Last 5, Players,
Jayson Tatum, then October 22, 2024. Mikal Bridges should lead with 6:02,
10 player points and 4/4 FG. Recent-game tracking can legitimately show
unavailable. The saved NBA fixtures test both states without a connection.

## Quarter-stat research

See `research/team-quarter-validation.md` for the completed milestone's checks,
and `research/quarter-stat-options.md` for the earlier source investigation.
The exploratory script runs separately; it is **not used by the app**:

```powershell
node research/quarter-feasibility.mjs
```

It compares simple play-by-play counts with published team totals for three
games. The app now uses the stronger parser in `server/quarters.js`, checked
against saved games and manually tallied periods in `server/fixtures/`.
`research/data-source-findings.md` retains the
earlier investigation; its description of an unchanged demo refers to that
earlier milestone, before this integration.
