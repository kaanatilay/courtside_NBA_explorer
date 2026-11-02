import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { teams, metrics, currentSeason } from './catalog.js';
import { rowsFor, playersFor, average } from './stats.js';
import './styles.css';

const number = value => Number.isFinite(value) ? value.toFixed(1) : '—';
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const teamFor = id => teams.find(team => team.id === id);
const seasonLabel = year => `${year - 1}–${String(year).slice(-2)}`;
const seasons = Array.from({ length: 3 }, (_, index) => currentSeason() - index);

// Each request owns an AbortController. Rapid filter changes discard earlier
// results, so an old response cannot overwrite the currently selected matchup.
function useData(url, refreshToken) {
  const [state, setState] = useState({ url: null, data: null, error: null });
  const previousRefresh = useRef(refreshToken);
  const lastSuccess = useRef(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    // Force downloads for a new button press, not subsequent filter changes.
    let requestUrl = url;
    let forced = false;
    const scope = new URL(url, window.location.origin);
    scope.searchParams.delete('refresh');
    scope.searchParams.delete('request');
    if (refreshToken !== undefined) {
      const parsed = new URL(url, window.location.origin);
      forced = previousRefresh.current !== refreshToken;
      parsed.searchParams.set('refresh', forced ? '1' : '0');
      previousRefresh.current = refreshToken;
      requestUrl = parsed.pathname + parsed.search;
    }
    setState({ url, data: null, error: null });
    (async () => {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'The data request failed.');
        if (!controller.signal.aborted) {
          lastSuccess.current = { scope: scope.href, data: body };
          setState({ url, data: body, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          // A missing new game can prevent a complete refreshed sample. Keep
          // only the exact previous selection, never another filter's results.
          const prior = forced && lastSuccess.current?.scope === scope.href ? lastSuccess.current.data : null;
          setState({ url, data: prior ? { ...prior, savedRecordsUsed: true,
            warnings: [...(prior.warnings || []), `Showing the previous result: ${error.message}`] } : null,
            error: prior ? null : error.message });
        }
      }
    })();
    return () => controller.abort();
  }, [url, refreshToken]);
  // Hide old data immediately, including the render before the effect runs.
  if (!url) return { data: null, error: null, loading: false };
  return state.url === url ? { ...state, loading: !state.data && !state.error } : { data: null, error: null, loading: Boolean(url) };
}

// The server owns the cycle so changing filters or reloading the page doesn't
// start duplicate work. Poll only while it runs; failures remain visible.
function LeagueRefresh({ onUpdated }) {
  const [status, setStatus] = useState({ state: 'idle' });
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const notify = useRef(onUpdated);
  notify.current = onUpdated;
  useEffect(() => {
    let active = true;
    fetch('/api/refresh').then(r => { if (!r.ok) throw new Error('Could not read refresh status.'); return r.json(); })
      .then(s => { if (active) setStatus(current => current.state === 'running' ? current : s); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (status.state !== 'running') return;
    let active = true, timer;
    async function poll() {
      try {
        const response = await fetch('/api/refresh');
        if (!response.ok) throw new Error('Could not read refresh progress.');
        const next = await response.json();
        if (!active) return;
        setError(null); setStatus(next);
        if (next.state === 'running') timer = setTimeout(poll, 1000);
        else notify.current();
      } catch (e) {
        if (active) { setError(`${e.message} The server may still be working; reconnecting…`); timer = setTimeout(poll, 3000); }
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { active = false; clearTimeout(timer); };
  }, [status.state]);
  async function start() {
    setStarting(true); setError(null);
    try {
      const response = await fetch('/api/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Could not start the league refresh.');
      setStatus(await response.json());
    } catch (e) { setError(e.message); }
    finally { setStarting(false); }
  }
  return <div className="state-message" aria-live="polite">
    <div className="data-toolbar"><div><strong>League data update</strong><p className="sample-caption">All 30 teams · {seasonLabel(currentSeason())} regular season · Missing games + corrections from the last 7 days. Historical selections and defender tracking are separate.</p></div>
      <button className="close-button" onClick={start} disabled={starting || status.state === 'running'}>{starting || status.state === 'running' ? 'Updating league…' : 'Refresh league data ↻'}</button></div>
    {status.state === 'running' && <p role="status">{status.phase === 'directory' ? 'Discovering NBA teams…' : status.phase === 'schedules' ? `Checking schedules: ${status.teamsChecked} / ${status.teamsTotal}` : `Retrieving games: ${status.gamesChecked} / ${status.gamesTotal}`} · Added {status.added} · Updated {status.updated} · Failures {status.failures.length}</p>}
    {['complete', 'partial', 'failed'].includes(status.state) && <p><strong>{status.state === 'complete' ? 'Update complete' : status.state === 'partial' ? 'Update incomplete' : 'Update failed'}</strong> · {status.added} games added · {status.updated} games re-downloaded · {status.olderGamesReused} older games reused · {status.failures.length} failures · {status.finishedAt && new Date(status.finishedAt).toLocaleString()}</p>}
    {status.failures?.length > 0 && <details><summary>Failed items — saved data retained where available</summary>{status.failures.map((f, i) => <p key={i}>{f.kind} {f.id}: {f.message}</p>)}</details>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

// Saved results remain distinguishable from a successful provider refresh.
function SavedDataStatus({ data }) {
  return <div><p className="freshness">Source: ESPN · {data.savedRecordsUsed ? 'Includes saved records' : 'Downloaded records'} · Oldest download {new Date(data.oldestFetchedAt).toLocaleString()} · Refresh data checks for new games and corrections. Regular season only; coverage may be incomplete.</p>
    {data.warnings?.length > 0 && <div className="state-message error" role="alert"><strong>Refresh incomplete — showing saved records where available.</strong><p>Some downloads failed. Saved values have not been replaced for those records.</p><details><summary>Download details</summary>{data.warnings.map(warning => <p key={warning}>{warning}</p>)}</details></div>}</div>;
}

// Compact summaries identify the pair; all selection happens in the band above.
function TeamCard({ id, label }) {
  const team = teamFor(id);
  return <section className="team-card" style={{ '--team': team.color }}>
    <div className="card-top"><span className="eyebrow">{label}</span><span className="small-dot" /></div>
    <div className="team-identity"><div className="team-badge">{id}</div><div><p className="city">{team.city}</p><h2>{team.name}</h2></div></div>
  </section>;
}

// One horizontal list serves either comparison slot. Native buttons support
// Tab/Enter; arrow keys and Home/End move focus and scroll cards into view.
function TeamBand({ left, right, onSelect }) {
  const [slot, setSlot] = useState('left');
  const rail = useRef(null);
  const cards = useRef([]);
  const ordered = [...teams].sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));
  const current = slot === 'left' ? left : right;
  const other = slot === 'left' ? right : left;
  function moveFocus(event, index) {
    const target = event.key === 'ArrowRight' ? Math.min(index + 1, ordered.length - 1)
      : event.key === 'ArrowLeft' ? Math.max(index - 1, 0)
      : event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : null;
    if (target === null) return;
    event.preventDefault(); cards.current[target]?.focus();
  }
  function scroll(direction) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.75, behavior: reduced ? 'instant' : 'smooth' });
  }
  return <section className="team-picker" aria-labelledby="team-picker-title">
    <div className="picker-heading"><div><p className="eyebrow accent">THE WHOLE LEAGUE</p><h2 id="team-picker-title">Choose your two teams.</h2><p className="sample-caption" id="team-picker-help">Choose a slot, then a team. Scroll or use the arrows to explore all 30.</p></div>
      <div className="picker-slots" role="group" aria-label="Choose comparison slot">
        <button aria-pressed={slot === 'left'} onClick={() => setSlot('left')} style={{ '--team': teamFor(left).color }}><small>TEAM A</small><strong>{left}</strong><span>{slot === 'left' ? 'Selecting' : 'Change'}</span></button>
        <button aria-pressed={slot === 'right'} onClick={() => setSlot('right')} style={{ '--team': teamFor(right).color }}><small>TEAM B</small><strong>{right}</strong><span>{slot === 'right' ? 'Selecting' : 'Change'}</span></button>
      </div>
    </div>
    <div className="team-band-shell"><button className="band-arrow" aria-label="Scroll teams left" onClick={() => scroll(-1)}>←</button>
      <div className="team-band" ref={rail} role="group" aria-label={`NBA teams for Team ${slot === 'left' ? 'A' : 'B'}`} aria-describedby="team-picker-help">
        {ordered.map((team, index) => <button key={team.id} ref={node => { cards.current[index] = node; }} className={`band-team ${team.id === left || team.id === right ? 'chosen' : ''}`}
          style={{ '--team': team.color }} aria-pressed={team.id === current} aria-disabled={team.id === other}
          aria-label={`${team.city} ${team.name}${team.id === other ? ', already selected for the other team' : ''}`}
          onKeyDown={event => moveFocus(event, index)} onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
          onClick={() => { if (team.id !== other) onSelect(slot, team.id); }}>
          <span className="band-selection">{team.id === left ? 'TEAM A' : team.id === right ? 'TEAM B' : team.id}</span>
          <span className="band-badge">{team.id}</span><span className="band-city">{team.city}</span><strong>{team.name}</strong>
        </button>)}
      </div><button className="band-arrow" aria-label="Scroll teams right" onClick={() => scroll(1)}>→</button>
    </div><p className="picker-caption" role="status">Selecting Team {slot === 'left' ? 'A' : 'B'} · {teamFor(left).city} {teamFor(left).name} vs {teamFor(right).city} {teamFor(right).name}</p>
  </section>;
}

// Dates/counts always describe the actual observations, including short samples.
function SampleSummary({ id, rows, limit, label = 'games' }) {
  return <div><strong style={{ color: teamFor(id).color }}>{id}</strong>
    <span>{rows.length} {label}{rows.length < Number(limit) ? ' (fewer than requested)' : ''}</span>
    <small>{rows.length ? `${dateLabel(rows.at(-1).date)} — ${dateLabel(rows[0].date)}` : 'No matching games in this season'}</small>
  </div>;
}

function App() {
  const [left, setLeft] = useState('BOS');
  const [right, setRight] = useState('LAL');
  const [mode, setMode] = useState('recent');
  const [limit, setLimit] = useState('5');
  const [season, setSeason] = useState(String(currentSeason()));
  const [quarter, setQuarter] = useState('all');
  const [view, setView] = useState('teams');
  const [player, setPlayer] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const ids = [left, right];
  const query = new URLSearchParams({ left, right, mode, limit, season, refresh: '0', request: String(refresh) });
  const comparison = useData(`/api/comparison?${query}`);
  const gamesFor = id => (comparison.data?.samples[id] || []).map(gameId => comparison.data.games.find(game => game.id === gameId));
  const samples = ids.map(gamesFor);
  const rows = ids.map((id, index) => rowsFor(samples[index], id, quarter));

  // Close details when changing the sample, so a player cannot retain another
  // team's or season's context. Quarter changes are a browser-only calculation.
  function changeFilter(setter, value) { setter(value); setPlayer(null); }
  function selectView(value) { setView(value); setPlayer(null); if (value === 'players') setQuarter('all'); }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">◉</span> courtside<span className="brand-light"> / explorer</span></a><span className="demo-pill"><span /> REAL DATA · ESPN</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow accent">THE GAME, FROM YOUR ANGLE</p><h1>Find the story.<br /><span>Behind the numbers.</span></h1><p className="intro-copy">Two teams. A closer look at the game.</p></div><div className="edition"><span>02 / REAL GAME EXPLORER</span><p>Choose your teams.<br />Make your own comparisons.</p></div></section>
      <div className="demo-note"><span>ⓘ</span><p><strong>Real completed-game data from ESPN.</strong> Team quarter counts are calculated from play-by-play and checked against game totals. Selected regular season only. Dates use the NBA schedule’s Eastern Time.</p></div>
      <TeamBand left={left} right={right} onSelect={(slot, id) => { if (id !== (slot === 'left' ? right : left)) changeFilter(slot === 'left' ? setLeft : setRight, id); }} />
      <div className="team-grid"><TeamCard id={left} label="Team A" /><div className="versus">VS</div><TeamCard id={right} label="Team B" /></div>
      <section className="filterbar" aria-label="Comparison filters">
        <label>Season<select aria-label="Season" value={season} onChange={e => changeFilter(setSeason, e.target.value)}>{seasons.map(year => <option key={year} value={year}>{seasonLabel(year)}</option>)}</select></label>
        <label>Game sample<select aria-label="Game sample" value={mode} onChange={e => changeFilter(setMode, e.target.value)}><option value="matchup">Against each other</option><option value="recent">All opponents</option></select></label>
        <label>Look back<select aria-label="Look back" value={limit} onChange={e => changeFilter(setLimit, e.target.value)}><option value="3">Last 3 games</option><option value="5">Last 5 games</option><option value="10">Last 10 games</option></select></label>
        <div className="quarter-control"><span className="filter-label">Period {view === 'players' && '· full game only'}</span><div className="segmented">{['all', '1', '2', '3', '4'].map(q => <button key={q} aria-pressed={quarter === q} disabled={view === 'players' && q !== 'all'} title={view === 'players' && q !== 'all' ? 'Player quarter data is not verified yet.' : undefined} className={quarter === q ? 'active' : ''} onClick={() => setQuarter(q)}>{q === 'all' ? 'Full game' : `Q${q}`}</button>)}</div></div>
      </section>
      <section className="results" aria-busy={comparison.loading}>
        <div className="section-heading"><div><p className="eyebrow">YOUR COMPARISON</p><h2>{view === 'teams' ? 'The matchup, at a glance.' : 'Meet the difference makers.'}</h2></div><div className="view-switch">{['teams', 'players'].map(tab => <button key={tab} className={view === tab ? 'active' : ''} aria-pressed={view === tab} onClick={() => selectView(tab)}>{tab === 'teams' ? 'Team stats' : 'Players'}</button>)}</div></div>
        <div className="data-toolbar"><p className="sample-caption">{quarter === 'all' ? 'Full-game (includes OT)' : `Q${quarter}`} averages · {mode === 'matchup' ? 'Head-to-head games' : 'Recent games against all opponents'} · Last {limit} · {seasonLabel(Number(season))}</p></div>
        <LeagueRefresh onUpdated={() => setRefresh(value => value + 1)} />
        {comparison.loading && <p className="state-message" role="status">Loading real game records… First-time requests can take a little longer.</p>}
        {comparison.error && <div className="state-message error" role="alert"><strong>Couldn’t load the comparison.</strong><p>{comparison.error}</p><button className="close-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {comparison.data && <>
          <SavedDataStatus data={comparison.data} />
          <div className="sample-grid">{ids.map((id, i) => <SampleSummary key={id} id={id} rows={rows[i]} limit={limit} />)}</div>
          {quarter !== 'all' && <p className="availability-note"><strong>Calculated from play-by-play.</strong> Points come from ESPN’s period scores; assists, rebounds and blocks are calculated from recorded plays and checked against full-game totals. “—” means unavailable or a failed check. An average is withheld if any selected game lacks that metric.</p>}
          {view === 'teams' ? <>
            <div className="comparison-table"><div className="stat-header"><span>{left}</span><span>PER GAME</span><span>{right}</span></div>{metrics.map(([key, label]) => {
              const values = rows.map(items => average(items, key));
              const showBar = values.every(Number.isFinite) && values[0] + values[1] > 0;
              return <div className="stat-row" key={key}><strong style={{ color: teamFor(left).color }}>{number(values[0])}</strong><div><span>{label}</span>{showBar && <div className="balance"><i style={{ width: `${values[0] / (values[0] + values[1]) * 100}%`, background: teamFor(left).color }} /><i style={{ flex: 1, background: teamFor(right).color }} /></div>}</div><strong style={{ color: teamFor(right).color }}>{number(values[1])}</strong></div>;
            })}</div>
            <div className="history-grid">{ids.map((id, index) => <GameHistory key={id} title={`${id} · included games`} rows={rows[index]} quarter={quarter} />)}</div>
          </> : <>
            <p className="availability-note">Roster averages below use appearances within the team sample above. Click a player to search for their own last {limit} appearances with this team and opponent filter, within {seasonLabel(Number(season))}.</p>
            <div className="roster-grid">{ids.map((id, index) => <Roster key={id} id={id} games={samples[index]} selected={player} onSelect={selected => setPlayer({ ...selected, teamId: id })} />)}</div>
            {player ? <PlayerDetails key={`${player.teamId}-${player.id}`} player={player} opponent={player.teamId === left ? right : left} mode={mode} limit={limit} season={season} refresh={refresh} onClose={() => setPlayer(null)} /> : <div className="detail-hint">↗ Select a player to explore their last appearances and dated game log.</div>}
          </>}
        </>}
      </section>
      <footer><span>COURTSIDE <span className="muted">/ A different perspective.</span></span><span>Local prototype · ESPN data · No predictions</span></footer>
    </main>
  </div>;
}

// A list of real participants, rather than a fabricated or assumed current
// roster. Its sample size is stated separately for each player's averages.
function Roster({ id, games, selected, onSelect }) {
  const players = playersFor(games, id);
  return <section className="roster"><h3>{id}<span>{players.length} players in team sample</span></h3>
    <div className="roster-head"><span>PLAYER / APPEARANCES</span><span>MIN</span><span>PTS</span><span>AST</span></div>
    {!players.length && <p className="roster-empty">No players found in this sample. Try another season or opponent filter.</p>}
    {players.map(player => {
      const logs = rowsFor(games, id, 'all', player.id);
      const active = selected?.id === player.id && selected?.teamId === id;
      return <button className={`player-row ${active ? 'selected' : ''}`} key={player.id} onClick={() => onSelect(player)} aria-pressed={active}><span><b className="avatar">{player.name.split(' ').map(name => name[0]).slice(0, 2).join('')}</b><span>{player.name}<small>{logs.length} appearances · View own sample ↗</small></span></span><span>{number(average(logs, 'min'))}</span><span>{number(average(logs, 'pts'))}</span><span>{number(average(logs, 'ast'))}</span></button>;
    })}
  </section>;
}

// The server scans older games to find appearances, skipping DNP/missing rows.
// Detail results have their own loading/error state and visible sample bounds.
function PlayerDetails({ player, opponent, mode, limit, season, refresh, onClose }) {
  const query = new URLSearchParams({ left: player.teamId, right: opponent, player: player.id, mode, limit, season, refresh: '0', request: String(refresh) });
  const result = useData(`/api/player?${query}`);
  const rows = rowsFor(result.data?.games || [], player.teamId, 'all', player.id);
  return <section className="player-details" aria-live="polite" aria-busy={result.loading}>
    <div className="detail-title"><div><p className="eyebrow">PLAYER DETAIL · {player.teamId} · FULL GAME</p><h3>{player.name}</h3></div><button className="close-button" onClick={onClose}>Close details ×</button></div>
    {result.loading && <p role="status">Searching this season for the last {limit} appearances…</p>}
    {result.error && <p role="alert">Couldn’t load this player: {result.error} Close and reopen the details to retry.</p>}
    {result.data && <><p className="sample-caption">{rows.length} of {limit} requested appearances · {result.data.inspected} matching team games checked · {seasonLabel(Number(season))} only. Missing/DNP records excluded; absence alone does not identify why a player missed a game.</p><div className="sample-grid"><SampleSummary id={player.teamId} rows={rows} limit={limit} label="appearances" /></div>
      <div className="player-metrics">{[['min', 'Minutes'], ...metrics].map(([key, label]) => <div key={key}><span>{label}</span><strong>{number(average(rows, key))}</strong></div>)}</div><GameHistory title="Included player performances" rows={rows} player />
      <SavedDataStatus data={result.data} />
      <DefenderMatchups player={player} games={result.data.games} season={season} refresh={0} />
    </>}
  </section>;
}

// Fetch tracking only after a game is chosen. Its loading/error/availability
// state is separate from the ESPN log, which remains usable if tracking fails.
function DefenderMatchups({ player, games, season, refresh }) {
  const [gameId, setGameId] = useState('');
  const [retry, setRetry] = useState(0);
  const selected = games.find(game => game.id === gameId);
  const query = new URLSearchParams({ team: player.teamId, player: player.id, game: gameId, season,
    refresh: refresh || retry ? '1' : '0', request: `${refresh}-${retry}` });
  const result = useData(selected ? `/api/matchups?${query}` : null);
  const display = value => Number.isFinite(value) ? value : '—';
  const shooting = (made, attempted) => `${display(made)}/${display(attempted)}`;
  return <section className="history defender-matchups" aria-busy={result.loading}>
    <h3>Who guarded {player.name}?</h3>
    <label className="team-select">Choose a completed game<select aria-label="Defender matchup game" value={selected ? gameId : ''} onChange={event => { setGameId(event.target.value); setRetry(0); }}>
      <option value="">Select a game…</option>{games.map(game => <option key={game.id} value={game.id}>{dateLabel(game.date)} · vs {Object.keys(game.sides).find(id => id !== player.teamId)}</option>)}
    </select></label>
    <p className="availability-note">Actual NBA defender tracking, when archived. Ranked by matchup time. Points, shooting, assists and turnovers belong to the selected player; blocks are credited to the defender. Matchup assignments can overlap or be incomplete: do not add these rows to reconstruct the full-game box score.</p>
    {result.loading && <p role="status">Checking game and player identities, then loading defender tracking…</p>}
    {result.error && <p role="alert">Couldn’t load tracking: {result.error}</p>}
    {result.data && <>
      {!result.data.available ? <p className="state-message">Unavailable: {result.data.reason}</p> : <>
        <p className="sample-caption"><strong>{result.data.primaryIds.length > 1 ? 'Joint primary defenders' : 'Primary defender'} by matchup time: </strong>{result.data.defenders.filter(row => result.data.primaryIds.includes(row.id)).map(row => `${row.name} (${row.time})`).join(', ')}</p>
        <div className="table-scroll"><table><thead><tr><th>Defender</th><th>Time</th><th>PTS</th><th>FGM/FGA</th><th>3PM/3PA</th><th>AST</th><th>TO</th><th>Defender BLK</th></tr></thead><tbody>{result.data.defenders.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.time}</td><td>{display(row.pts)}</td><td>{shooting(row.fgm, row.fga)}</td><td>{shooting(row.threeMade, row.threeAttempted)}</td><td>{display(row.ast)}</td><td>{display(row.turnovers)}</td><td>{display(row.blocks)}</td></tr>)}</tbody></table></div>
      </>}
      <p className="freshness">NBA Stats via SportsDataverse · Historical archive, availability can lag.{result.data.source && <> <a href={result.data.source} target="_blank" rel="noreferrer">Game source ↗</a></>}{result.data.fetchedAt && <> · Downloaded {new Date(result.data.fetchedAt).toLocaleString()}</>} · <a href="https://github.com/sportsdataverse/hoopR-nba-stats-raw" target="_blank" rel="noreferrer">Archive / license ↗</a></p>
    </>}
    {selected && !result.loading && <button className="close-button" onClick={() => setRetry(value => value + 1)}>Retry tracking ↻</button>}
  </section>;
}

// Link every game to its provider record so displayed observations can be
// checked. Empty samples remain empty; unverified stats display an em dash.
function GameHistory({ title, rows, player = false, quarter = 'all' }) {
  return <section className="history"><h3>{title}</h3>{rows.length ? <><div className="table-scroll"><table><thead><tr><th>Date (ET) / source</th><th>Vs</th>{player && <th>MIN</th>}{metrics.map(([key, label]) => <th key={key} title={label}>{key.toUpperCase()}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><a href={row.source} target="_blank" rel="noreferrer">{dateLabel(row.date)} ↗</a></td><td>{row.opponent}</td>{player && <td>{number(row.min)}</td>}{metrics.map(([key]) => <td key={key}>{Number.isFinite(row[key]) ? row[key] : '—'}</td>)}</tr>)}</tbody></table></div>{!player && quarter !== 'all' && <QuarterChecks rows={rows} />}</> : <p className="sample-caption">No completed matching games were returned for this season.</p>}</section>;
}

// Explain exactly which included games could not supply a metric, rather than
// silently dropping them from the average or presenting an unexplained dash.
function QuarterChecks({ rows }) {
  const keys = metrics.filter(([key]) => key !== 'pts');
  const complete = rows.filter(row => keys.every(([key]) => Number.isFinite(row[key]))).length;
  const missing = rows.filter(row => keys.some(([key]) => !Number.isFinite(row[key])));
  return <div className="quarter-checks"><p>Calculated counts passed checks in {complete}/{rows.length} games.</p>
    {missing.length > 0 && <details><summary>Why some quarter stats are unavailable</summary><ul>{missing.map(row => <li key={row.id}><strong>{dateLabel(row.date)}:</strong> {keys.filter(([key]) => !Number.isFinite(row[key])).map(([key, label]) => `${label}: ${row.quarterValidation?.unavailable[key] || 'Period data is unavailable.'}`).join(' ')}</li>)}</ul></details>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
