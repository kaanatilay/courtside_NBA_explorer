import React, { useRef, useState } from 'react';
import { fullGameMetrics, percentagePairs } from './catalog.js';
import { average } from './stats.js';
import { blankLayout, cleanLayout, readLayoutLibrary, layoutStorageKey, snap, cardSize, removeCard, connectCards, nextCardPosition } from './layout.js';

const uid = () => crypto.randomUUID();
const format = (value, metric) => !Number.isFinite(value) ? '—' : `${value.toFixed(1)}${percentagePairs[metric] ? '%' : ''}`;

// This workspace owns presentation only. Rows always come from the same current
// comparison as Default view; loading/filter changes never overwrite positions.
export default function CustomWorkspace({ ids, rows, loading, error, period }) {
  const [library, setLibrary] = useState(() => { try { return readLayoutLibrary(localStorage); } catch { return []; } });
  const [draft, setDraft] = useState(blankLayout);
  const [activeId, setActiveId] = useState('');
  const [metric, setMetric] = useState('pts');
  const [message, setMessage] = useState('Start blank, add cards, then save a named layout.');
  const [dirty, setDirty] = useState(false);
  const [from, setFrom] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const gesture = useRef(null);
  const viewport = useRef(null);

  function edit(next) { setDraft(next); setDirty(true); }
  function persist(next) {
    try { localStorage.setItem(layoutStorageKey, JSON.stringify({ version: 1, layouts: next })); setLibrary(next); return true; }
    catch { setMessage('Could not save in this browser. Your current canvas remains open; browser storage may be blocked or full.'); return false; }
  }
  function save(copy = false) {
    const name = draft.name.trim();
    if (!name) { setMessage('Enter a layout name before saving.'); return; }
    const id = !copy && activeId ? activeId : uid();
    const record = { id, ...cleanLayout({ ...draft, name }) };
    if (persist([...library.filter(l => l.id !== id), record])) {
      setActiveId(id); setDraft(record); setDirty(false); setMessage(`Saved “${name}” in this browser.`);
    }
  }
  function open(id) {
    if (dirty && !window.confirm('Discard unsaved canvas changes?')) return;
    setActiveId(id); setDraft(id ? cleanLayout(library.find(l => l.id === id)) : blankLayout());
    setDirty(false); setFrom(null); setCamera({ x: 0, y: 0, zoom: 1 });
    setMessage(id ? 'Layout opened with current comparison values.' : 'New blank layout.');
  }
  function add() {
    if (draft.cards.length >= 100) { setMessage('This prototype supports up to 100 cards per layout.'); return; }
    const position = nextCardPosition(draft.cards);
    edit({ ...draft, cards: [...draft.cards, { id: uid(), metric, ...position }] });
    setCamera(c => {
      const width = viewport.current?.clientWidth || 600, height = viewport.current?.clientHeight || 560;
      const visible = position.x * c.zoom + c.x >= 0 && (position.x + cardSize.width) * c.zoom + c.x <= width
        && position.y * c.zoom + c.y >= 0 && (position.y + cardSize.height) * c.zoom + c.y <= height;
      return visible ? c : { ...c, x: 20 - position.x * c.zoom, y: 20 - position.y * c.zoom };
    });
  }
  function connect(id) {
    if (!from) { setFrom(id); setMessage('Choose Connect on a second card. Lines organize cards; they do not calculate or share extra filters.'); }
    else { edit(connectCards(draft, from, id)); setFrom(null); setMessage(from === id ? 'Connection cancelled.' : 'Visual connection added.'); }
  }
  function start(e, card = null) {
    if (e.button !== 0 || (!card && e.target.closest('button,input,select,.workspace-card'))) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { cardId: card?.id, x: e.clientX, y: e.clientY, originX: card?.x ?? camera.x, originY: card?.y ?? camera.y };
  }
  function move(e) {
    const g = gesture.current; if (!g) return;
    if (g.cardId) {
      const x = snap(g.originX + (e.clientX - g.x) / camera.zoom), y = snap(g.originY + (e.clientY - g.y) / camera.zoom);
      setDraft(d => ({ ...d, cards: d.cards.map(c => c.id === g.cardId ? { ...c, x, y } : c) })); setDirty(true);
    } else setCamera(c => ({ ...c, x: g.originX + e.clientX - g.x, y: g.originY + e.clientY - g.y }));
  }
  function end() { gesture.current = null; }
  function zoom(delta) {
    setCamera(c => {
      const next = Math.max(.5, Math.min(2, c.zoom + delta));
      const x = (viewport.current?.clientWidth || 600) / 2, y = 280;
      return { zoom: next, x: x - (x - c.x) * next / c.zoom, y: y - (y - c.y) * next / c.zoom };
    });
  }
  return <section className="custom-workspace" aria-label="Custom team statistics workspace">
    <div className="workspace-toolbar">
      <label>Saved layout<select value={activeId} onChange={e => open(e.target.value)}><option value="">New blank layout</option>{library.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <button className="close-button" onClick={() => open('')}>New blank</button>
      <label>Layout name<input maxLength={80} value={draft.name} placeholder="e.g. Shooting comparison" onChange={e => edit({ ...draft, name: e.target.value })} /></label>
      <button className="close-button" onClick={() => save(false)}>Save{dirty ? ' *' : ''}</button>
      <button className="close-button" disabled={!activeId} onClick={() => save(true)}>Save a copy</button>
    </div>
    <div className="workspace-toolbar">
      <label>Card statistic<select value={metric} onChange={e => setMetric(e.target.value)}>{fullGameMetrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="close-button" onClick={add}>+ Add card</button>
      <button className="close-button" aria-label="Zoom out workspace" onClick={() => zoom(-.1)}>−</button><span>{Math.round(camera.zoom * 100)}%</span>
      <button className="close-button" aria-label="Zoom in workspace" onClick={() => zoom(.1)}>+</button>
      <button className="close-button" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>Reset view</button>
      <button className="close-button" disabled={!draft.cards.length} onClick={() => { edit({ ...draft, cards: draft.cards.map((c,i) => ({ ...c, x: 20 + i % 3 * 300, y: 20 + Math.floor(i / 3) * 220 })) }); setCamera({ x: 0, y: 0, zoom: 1 }); }}>Arrange cards</button>
      {from && <button className="close-button" onClick={() => setFrom(null)}>Cancel connection</button>}
    </div>
    <p className="freshness">{period === 'all' ? 'Full-game' : `Q${period}`} team comparison · Cards follow the selected teams and filters. Drag a card header to move it; drag the background to pan. Focus a header and use arrow keys to move by grid steps. Lines are visual only.</p>
    <p className="workspace-message" role="status">{message}{dirty && ' Unsaved changes.'}</p>
    <div className="workspace-viewport" ref={viewport} onPointerDown={e => start(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="workspace-world" style={{ transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})` }}>
        <svg className="workspace-links" width="10600" height="10600" aria-hidden="true">{draft.links.map(l => {
          const a = draft.cards.find(c => c.id === l.from), b = draft.cards.find(c => c.id === l.to);
          return a && b ? <line key={`${l.from}-${l.to}`} x1={a.x + cardSize.width / 2} y1={a.y + cardSize.height / 2} x2={b.x + cardSize.width / 2} y2={b.y + cardSize.height / 2} /> : null;
        })}</svg>
        {draft.cards.map((card,index) => {
          const label = fullGameMetrics.find(([key]) => key === card.metric)?.[1];
          return <article className={`workspace-card ${from === card.id ? 'connecting' : ''}`} key={card.id} style={{ left: card.x, top: card.y, width: cardSize.width, height: cardSize.height }}>
            <button className="workspace-card-handle" aria-label={`Move card ${index + 1}: ${label}`} onPointerDown={e => { e.stopPropagation(); start(e, card); }} onPointerMove={e => { e.stopPropagation(); move(e); }} onPointerUp={end} onPointerCancel={end}
              onKeyDown={e => {
                const directions = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] };
                if (!directions[e.key]) return; e.preventDefault(); const [x,y] = directions[e.key];
                edit({ ...draft, cards: draft.cards.map(c => c.id === card.id ? { ...c, x: snap(c.x+x), y: snap(c.y+y) } : c) });
              }}>⠿ {label}</button>
            <div className="workspace-values">{ids.map((id,i) => <div key={id}><span>{id}</span><strong>{loading ? '…' : error ? '—' : format(average(rows[i] || [], card.metric), card.metric)}</strong><small>{rows[i]?.length || 0} games</small></div>)}</div>
            <div className="workspace-card-actions"><button onClick={() => connect(card.id)}>{from === card.id ? 'Connecting…' : 'Connect'}</button><button onClick={() => { edit(removeCard(draft, card.id)); if (from === card.id) setFrom(null); }} aria-label={`Remove card ${index + 1}: ${label}`}>Remove</button></div>
          </article>;
        })}
      </div>
      {!draft.cards.length && <div className="workspace-empty">Your blank canvas<br /><span>Add a statistic card to begin. Add the same statistic more than once if useful.</span></div>}
    </div>
    {draft.cards.length > 0 && <details className="workspace-connections"><summary>Data checks and unavailable values</summary><p>“—” means missing/unverified values, no shooting attempts, or an empty sample. No metric silently drops missing games from its denominator.</p>{[...new Set(draft.cards.map(c => c.metric))].flatMap(key => ids.flatMap((id,i) => {
      const required = percentagePairs[key] || [key];
      return (rows[i] || []).flatMap(row => required.filter(k => row.quarterValidation?.unavailable?.[k] && period !== 'all').map(k => <p key={`${key}-${id}-${row.id}-${k}`}>{id} · {row.date} · {fullGameMetrics.find(([metric]) => metric === key)?.[1]}: {row.quarterValidation.unavailable[k]}</p>));
    }))}</details>}
    {draft.links.length > 0 && <details className="workspace-connections"><summary>Visual connections ({draft.links.length})</summary>{draft.links.map((l,i) => {
      const label = id => { const c = draft.cards.find(c => c.id === id); return `${fullGameMetrics.find(([k]) => k === c?.metric)?.[1]} (card ${draft.cards.indexOf(c)+1})`; };
      return <p key={i}>{label(l.from)} ↔ {label(l.to)} <button className="close-button" onClick={() => edit({ ...draft, links: draft.links.filter((_,j) => j !== i) })}>Remove line</button></p>;
    })}</details>}
  </section>;
}
