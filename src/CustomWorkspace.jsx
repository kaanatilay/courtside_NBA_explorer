import React, { useRef, useState } from 'react';
import { fullGameMetrics, percentagePairs } from './catalog.js';
import { average } from './stats.js';
import CardEditor from './CardEditor.jsx';
import CardContent from './CardContent.jsx';
import { cardPurposes } from './cardPurpose.js';
import ColorControl from './ColorControl.jsx';
import ContrastFeedback from './ContrastFeedback.jsx';
import { cardColorStyles, defaultColors, workspaceColorStyles, workspacePresets } from './appearance.js';
import { blankLayout, cleanLayout, readLayoutLibrary, layoutStorageKey, snap, cardSize, dimensions, resizeDimensions, arrangeLayout, createHistory, commitHistory, undoHistory, redoHistory, removeCard, connectCards, nextCardPosition, groupFor, groupBounds, moveCards, magneticPreview, applyMagnet, ungroup } from './layout.js';

const uid = () => crypto.randomUUID();
const format = (value, metric) => !Number.isFinite(value) ? '—' : `${value.toFixed(1)}${percentagePairs[metric] ? '%' : ''}`;
const minimumSize = card => resizeDimensions(card, cardSize);
const resizeLimitMessage = card => {
  const min=minimumSize(card);
  return `Inner content requires at least ${min.width} × ${min.height}. Use Edit card to move or shrink inner blocks before shrinking the outer card further.`;
};

// This workspace owns presentation only. Rows always come from the same current
// comparison as Default view; loading/filter changes never overwrite positions.
export default function CustomWorkspace({ ids, rows, loading, error, period }) {
  const [library, setLibrary] = useState(() => { try { return readLayoutLibrary(localStorage); } catch { return []; } });
  const [history, setHistory] = useState(() => createHistory(blankLayout()));
  // Group edits use a separate working copy. Cancel discards it; Confirm adds
  // the complete session to history once, without recording every small move.
  const [groupEdit, setGroupEdit] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [appearanceEdit,setAppearanceEdit]=useState(null);
  const draft = groupEdit?.working || history.present;
  const savedDraft = useRef(cleanLayout(blankLayout()));
  const dirty = JSON.stringify(cleanLayout(draft)) !== JSON.stringify(savedDraft.current);
  const [activeId, setActiveId] = useState('');
  const [metric, setMetric] = useState('pts');
  const [message, setMessage] = useState('Start blank, add cards, then save a named layout.');
  const [from, setFrom] = useState(null);
  const [preview, setPreview] = useState(null);
  const [magnets, setMagnets] = useState(true);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const gesture = useRef(null);
  const viewport = useRef(null);

  function edit(next) {
    if (groupEdit) setGroupEdit(g => ({ ...g, working: next }));
    else setHistory(h => commitHistory(h, next));
  }
  function showDraft(next) {
    if (groupEdit) setGroupEdit(g => ({ ...g, working: next }));
    else setHistory(h => ({ ...h, present: next }));
  }
  function beginGroupEdit(group) {
    if (gesture.current || groupEdit) return;
    setGroupEdit({ id: group.id, working: cleanLayout(draft) });
    setFrom(null); setPreview(null);
    setMessage('Editing group: move or resize each card, then Confirm or Cancel. Snapping is paused.');
  }
  function finishGroupEdit(confirm) {
    if (gesture.current || !groupEdit) return;
    if (confirm) setHistory(h => commitHistory(h, groupEdit.working));
    setGroupEdit(null);
    setMessage(confirm ? 'Group arrangement confirmed and locked. Save to keep it.' : 'Group edit cancelled; previous arrangement restored.');
  }
  function undo() { if (gesture.current || groupEdit || editingCard || appearanceEdit) return; setHistory(undoHistory); setFrom(null); setMessage('Undo applied. Save to keep this version.'); }
  function redo() { if (gesture.current || groupEdit || editingCard || appearanceEdit) return; setHistory(redoHistory); setFrom(null); setMessage('Redo applied. Save to keep this version.'); }
  function persist(next) {
    try { localStorage.setItem(layoutStorageKey, JSON.stringify({ version: 1, layouts: next })); setLibrary(next); return true; }
    catch { setMessage('Could not save in this browser. Your current canvas remains open; browser storage may be blocked or full.'); return false; }
  }
  function save(copy = false) {
    if (groupEdit) return;
    const name = draft.name.trim();
    if (!name) { setMessage('Enter a layout name before saving.'); return; }
    const id = !copy && activeId ? activeId : uid();
    const record = { id, ...cleanLayout({ ...draft, name }) };
    if (persist([...library.filter(l => l.id !== id), record])) {
      setActiveId(id); savedDraft.current = cleanLayout(record);
      setHistory(h => ({ ...h, present: cleanLayout(record) })); setMessage(`Saved “${name}” in this browser.`);
    }
  }
  function open(id) {
    if (groupEdit) return;
    if (dirty && !window.confirm('Discard unsaved canvas changes?')) return;
    const opened = cleanLayout(id ? library.find(l => l.id === id) : blankLayout());
    setActiveId(id); savedDraft.current = opened; setHistory(createHistory(opened));
    setFrom(null); setCamera({ x: 0, y: 0, zoom: 1 });
    setMessage(id ? 'Layout opened with current comparison values.' : 'New blank layout.');
  }
  function add() {
    if (draft.cards.length >= 100) { setMessage('This prototype supports up to 100 cards per layout.'); return; }
    const position = nextCardPosition(draft.cards);
    edit({ ...draft, cards: [...draft.cards, { id: uid(), metric, ...position, ...cardSize }] });
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
  function start(e, card = null, resize = false, group = null) {
    if (e.button !== 0 || (!card && !group && e.target.closest('button,input,select,.workspace-card'))) return;
    const memberGroup = card && groupFor(draft, card.id);
    if (groupEdit && (group || (card && memberGroup?.id !== groupEdit.id))) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const members = group || (memberGroup?.id === groupEdit?.id ? null : memberGroup);
    gesture.current = { cardId: card?.id, memberIds: members?.cards, resize, before: draft, zoom: camera.zoom, ...dimensions(card),
      x: e.clientX, y: e.clientY, originX: card?.x ?? camera.x, originY: card?.y ?? camera.y };
  }
  function move(e) {
    const g = gesture.current; if (!g) return;
    if (g.cardId || g.memberIds) {
      if (g.memberIds) {
        const next = moveCards(g.before, g.memberIds, (e.clientX-g.x)/g.zoom, (e.clientY-g.y)/g.zoom);
        showDraft(next);
        return;
      }
      const original=g.before.cards.find(c=>c.id===g.cardId);
      const requested={ width:g.width + Math.round((e.clientX-g.x)/g.zoom/20)*20,
        height:g.height + Math.round((e.clientY-g.y)/g.zoom/20)*20 };
      const change = g.resize ? resizeDimensions(original,requested)
        : { x: snap(g.originX + (e.clientX - g.x) / g.zoom), y: snap(g.originY + (e.clientY - g.y) / g.zoom) };
      g.resizeMessage=g.resize && (change.width>dimensions(requested).width || change.height>dimensions(requested).height) ? resizeLimitMessage(original) : null;
      const next = { ...g.before, cards: g.before.cards.map(c => c.id === g.cardId ? { ...c, ...change } : c) };
      const magnet = g.resize || groupEdit || !magnets || e.shiftKey ? null : magneticPreview(next, g.cardId);
      g.preview = magnet; setPreview(magnet);
      showDraft(next);
    } else setCamera(c => ({ ...c, x: g.originX + e.clientX - g.x, y: g.originY + e.clientY - g.y }));
  }
  function end(e) {
    const g = gesture.current; gesture.current = null;
    setPreview(null);
    if (!g?.cardId && !g?.memberIds) return;
    if(g.resizeMessage && e?.type!=='pointercancel')setMessage(g.resizeMessage);
    // Cancellation restores the pre-gesture snapshot; a completed pointer drag
    // records one entry regardless of how many pointermove events it generated.
    if (groupEdit) {
      if (e?.type === 'pointercancel') showDraft(g.before);
      return;
    }
    const magnet = e?.shiftKey ? null : g.preview;
    setHistory(h => e?.type === 'pointercancel' ? { ...h, present: g.before }
      : commitHistory(h, magnet ? applyMagnet(h.present, magnet, uid()) : h.present, g.before));
    if (magnet && e?.type !== 'pointercancel') setMessage('Cards snapped into a group. Drag its group handle to move together; Edit group adjusts members.');
  }
  // Outside edit mode headers move the entire group; edit mode routes the same
  // keyboard/pointer controls to one member while retaining membership.
  function moveByKey(e, ids) {
    const steps = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] };
    if (!steps[e.key]) return; e.preventDefault();
    edit(moveCards(draft, ids, ...steps[e.key]));
  }
  function zoom(delta) {
    setCamera(c => {
      const next = Math.max(.5, Math.min(2, c.zoom + delta));
      const x = (viewport.current?.clientWidth || 600) / 2, y = 280;
      return { zoom: next, x: x - (x - c.x) * next / c.zoom, y: y - (y - c.y) * next / c.zoom };
    });
  }
  return <section className="custom-workspace" aria-label="Custom team statistics workspace" onKeyDown={e => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('input,textarea,select,[contenteditable=true]')) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  }}>
    <fieldset className="workspace-toolbar workspace-controls" disabled={!!groupEdit||!!appearanceEdit}>
      <label>Saved layout<select value={activeId} onChange={e => open(e.target.value)}><option value="">New blank layout</option>{library.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <button className="close-button" onClick={() => open('')}>New blank</button>
      <label>Layout name<input maxLength={80} value={draft.name} placeholder="e.g. Shooting comparison" onChange={e => edit({ ...draft, name: e.target.value })} /></label>
      <button className="close-button" onClick={() => save(false)}>Save{dirty ? ' *' : ''}</button>
      <button className="close-button" disabled={!activeId} onClick={() => save(true)}>Save a copy</button>
    </fieldset>
    <fieldset className="workspace-toolbar workspace-controls" disabled={!!groupEdit||!!appearanceEdit}>
      <label>Card statistic<select value={metric} onChange={e => setMetric(e.target.value)}>{fullGameMetrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="close-button" onClick={add}>+ Add card</button>
      <button className="close-button" onClick={()=>{setFrom(null);setAppearanceEdit({background:draft.background});}}>Workspace colors</button>
      <label className="workspace-magnets"><input type="checkbox" checked={magnets} onChange={e => setMagnets(e.target.checked)} /> Magnetic snapping</label>
      <button className="close-button" disabled={!history.past.length} onClick={undo}>Undo</button>
      <button className="close-button" disabled={!history.future.length} onClick={redo}>Redo</button>
      <button className="close-button" aria-label="Zoom out workspace" onClick={() => zoom(-.1)}>−</button><span>{Math.round(camera.zoom * 100)}%</span>
      <button className="close-button" aria-label="Zoom in workspace" onClick={() => zoom(.1)}>+</button>
      <button className="close-button" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>Reset view</button>
      <button className="close-button" disabled={!draft.cards.length} onClick={() => { edit(arrangeLayout(draft)); setCamera({ x: 0, y: 0, zoom: 1 }); }}>Arrange cards</button>
      {from && <button className="close-button" onClick={() => setFrom(null)}>Cancel connection</button>}
    </fieldset>
    {appearanceEdit&&<div className="workspace-appearance-panel" role="region" aria-label="Workspace color editing">
      <ColorControl label="Workspace background" value={appearanceEdit.background||defaultColors.workspaceBackground} presets={workspacePresets} onChange={background=>setAppearanceEdit({background})} onReset={()=>setAppearanceEdit({})} />
      <ContrastFeedback background={appearanceEdit.background} workspace />
      <button className="close-button" onClick={()=>{edit({...draft,background:appearanceEdit.background});setAppearanceEdit(null);setMessage('Workspace color applied. Save the layout to retain it.');}}>Apply workspace color</button>
      <button className="close-button" onClick={()=>setAppearanceEdit(null)}>Cancel workspace color</button>
      <p>Preview only until Apply. Reset restores the original background; card data and positions remain intact.</p>
    </div>}
    {groupEdit && <div className="workspace-edit-bar" role="region" aria-label="Group editing">
      <span>Editing group · Move/resize individual cards. Membership stays intact.</span>
      <button className="close-button" onClick={() => finishGroupEdit(true)}>Confirm group edit</button>
      <button className="close-button" onClick={() => finishGroupEdit(false)}>Cancel group edit</button>
    </div>}
    <p className="freshness">{period === 'all' ? 'Full-game' : `Q${period}`} team comparison · Drag a header to move or a bottom-right corner to resize. Focus either handle and use arrows for grid steps. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (outside text fields). History resets on opening another layout or reloading. Pan, zoom and data changes are not layout edits. Lines are visual only.</p>
    <p className="workspace-message" role="status">{message}{dirty && ' Unsaved changes.'}</p>
    <p className="freshness">Magnets: overlap an ungrouped card to preview a snap; release to group. Side-by-side matches height; stacked matches width. Hold Shift while dragging or turn off Magnetic snapping to bypass magnets. Edit group unlocks member movement/resizing; Confirm locks it again. Connection lines are independent.</p>
    <div className="workspace-viewport" inert={appearanceEdit?true:undefined} style={{backgroundColor:appearanceEdit?(appearanceEdit.background||defaultColors.workspaceBackground):(draft.background||defaultColors.workspaceBackground),...workspaceColorStyles(appearanceEdit?appearanceEdit.background:draft.background)}} ref={viewport} onPointerDown={e => start(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="workspace-world" style={{ transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})` }}>
        {draft.groups.map((group, index) => {
          const box = groupBounds(draft, group);
          return <div key={group.id} className={`workspace-group ${groupEdit?.id === group.id ? 'editing' : ''}`} style={{ left: box.x-8, top: box.y-8, width: box.width+16, height: box.height+16 }}>
            <div className="workspace-group-toolbar" style={box.y < 40 ? { top: box.height+16, transform: 'none' } : undefined}>
              <button disabled={!!groupEdit} className="workspace-group-handle" aria-label={`Move group ${index+1}`} onPointerDown={e => { e.stopPropagation(); start(e, null, false, group); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                onKeyDown={e => moveByKey(e, group.cards)}>⠿ Group {index+1} · {group.cards.length} cards</button>
              <button disabled={!!groupEdit} aria-label={`Edit group ${index+1}`} onClick={() => beginGroupEdit(group)}>Edit group</button>
              <button disabled={!!groupEdit} aria-label={`Ungroup group ${index+1}`} onClick={() => { edit(ungroup(draft, group.id)); setMessage('Group separated; positions and visual lines kept.'); }}>Ungroup</button>
            </div>
          </div>;
        })}
        <svg className="workspace-links" width="12000" height="12000" aria-hidden="true">{draft.links.map(l => {
          const a = draft.cards.find(c => c.id === l.from), b = draft.cards.find(c => c.id === l.to);
          return a && b ? <line key={`${l.from}-${l.to}`} x1={a.x + dimensions(a).width / 2} y1={a.y + dimensions(a).height / 2} x2={b.x + dimensions(b).width / 2} y2={b.y + dimensions(b).height / 2} /> : null;
        })}</svg>
        {draft.cards.map((card,index) => {
          const label = fullGameMetrics.find(([key]) => key === card.metric)?.[1];
          const group = groupFor(draft, card.id);
          const editingMember = !!groupEdit && group?.id === groupEdit.id;
          const blocked = !!groupEdit && !editingMember;
          return <article className={`workspace-card ${Array.isArray(card.blocks) ? 'workspace-card-designed' : ''} ${from === card.id ? 'connecting' : ''}`} key={card.id} style={{ left: card.x, top: card.y, ...dimensions(card),...cardColorStyles(card.appearance) }}>
            <button disabled={blocked} className="workspace-card-handle" aria-label={`Move card ${index + 1}: ${label}`} onPointerDown={e => { e.stopPropagation(); start(e, card); }} onPointerMove={e => { e.stopPropagation(); move(e); }} onPointerUp={end} onPointerCancel={end}
              onKeyDown={e => {
                moveByKey(e, editingMember ? [card.id] : group?.cards || [card.id]);
              }} title={card.purpose ? `${cardPurposes[card.purpose]}${card.purpose==='comparison'?'':` · Team ${card.teamSlot.toUpperCase()}`}` : 'Flexible / legacy design'}>⠿ {label}{card.purpose&&` · ${card.purpose==='comparison'?'A/B':card.teamSlot.toUpperCase()}`}</button>
            {Array.isArray(card.blocks) ? <CardContent blocks={card.blocks} ids={ids} rows={rows} loading={loading} error={error} />
              : <div className="workspace-values">{ids.map((id,i) => <div key={id}><span>{id}</span><strong>{loading ? '…' : error ? '—' : format(average(rows[i] || [], card.metric), card.metric)}</strong><small>{rows[i]?.length || 0} games</small></div>)}</div>}
            <div className="workspace-card-actions"><button disabled={!!groupEdit} onClick={() => connect(card.id)}>{from === card.id ? 'Connecting…' : 'Connect'}</button><button disabled={!!groupEdit} aria-label={`Edit card ${index+1}: ${label}`} onClick={() => { if (!gesture.current) { setFrom(null); setEditingCard(card.id); } }}>Edit card</button><button disabled={!!groupEdit} onClick={() => { edit(removeCard(draft, card.id)); if (from === card.id) setFrom(null); }} aria-label={`Remove card ${index + 1}: ${label}`}>Remove</button></div>
            <button className="workspace-resize-handle" disabled={blocked || (!!group && !editingMember)} aria-label={`Resize card ${index + 1}: ${label}`} title={group && !editingMember ? 'Choose Edit group to resize this member.' : `Resize: ${dimensions(card).width} × ${dimensions(card).height}; minimum ${minimumSize(card).width} × ${minimumSize(card).height}${card.blocks?.length ? ' (inner content bounds)' : ''}`}
              onPointerDown={e => { e.stopPropagation(); start(e, card, true); }} onPointerMove={e => { e.stopPropagation(); move(e); }} onPointerUp={end} onPointerCancel={end}
              onKeyDown={e => {
                const steps = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] };
                if (!steps[e.key]) return; e.preventDefault(); const [w,h] = steps[e.key], size = dimensions(card);
                const requested={width:size.width+w,height:size.height+h}, next=resizeDimensions(card,requested);
                if(next.width>dimensions(requested).width || next.height>dimensions(requested).height)setMessage(resizeLimitMessage(card));
                edit({ ...draft, cards: draft.cards.map(c => c.id === card.id ? { ...c, ...next } : c) });
              }}>↘</button>
          </article>;
        })}
        {preview && <div className="workspace-snap-preview" style={{ left: preview.card.x, top: preview.card.y, width: preview.card.width, height: preview.card.height }}><span>Release to group · {preview.side}</span></div>}
      </div>
      {!draft.cards.length && <div className="workspace-empty">Your blank canvas<br /><span>Add a statistic card to begin. Add the same statistic more than once if useful.</span></div>}
    </div>
    {editingCard && <CardEditor key={editingCard} card={draft.cards.find(c => c.id === editingCard)} otherCards={draft.cards.filter(c=>c.id!==editingCard)} ids={ids} rows={rows} loading={loading} error={error}
      onCancel={() => { setEditingCard(null); setMessage('Card edit cancelled; previous design kept.'); }}
      onApply={(blocks,frame) => {
        // All block edits become one history entry; membership and outer card
        // positions stay unchanged; optional template dimensions join the same
        // transaction. Group boundaries derive from these updated rectangles.
        edit({ ...draft, cards: draft.cards.map(c => c.id === editingCard ? { ...c, ...frame, blocks } : c) });
        setEditingCard(null); setMessage('Card design applied. Undo restores the previous design; Save keeps it across reloads.');
      }} />}
    {draft.cards.length > 0 && <details className="workspace-connections"><summary>Data checks and unavailable values</summary><p>“—” means missing/unverified values, no shooting attempts, or an empty sample. No metric silently drops missing games from its denominator. Bar lengths are relative to the largest shown team value.</p>{[...new Set(draft.cards.flatMap(c => Array.isArray(c.blocks) ? c.blocks.map(b => b.metric) : [c.metric]))].flatMap(key => ids.flatMap((id,i) => {
      const required = percentagePairs[key] || [key];
      return (rows[i] || []).flatMap(row => required.filter(k => row.quarterValidation?.unavailable?.[k] && period !== 'all').map(k => <p key={`${key}-${id}-${row.id}-${k}`}>{id} · {row.date} · {fullGameMetrics.find(([metric]) => metric === key)?.[1]}: {row.quarterValidation.unavailable[k]}</p>));
    }))}</details>}
    {draft.links.length > 0 && <details className="workspace-connections"><summary>Visual connections ({draft.links.length})</summary>{draft.links.map((l,i) => {
      const label = id => { const c = draft.cards.find(c => c.id === id); return `${fullGameMetrics.find(([k]) => k === c?.metric)?.[1]} (card ${draft.cards.indexOf(c)+1})`; };
      return <p key={i}>{label(l.from)} ↔ {label(l.to)} <button disabled={!!groupEdit||!!appearanceEdit} className="close-button" onClick={() => edit({ ...draft, links: draft.links.filter((_,j) => j !== i) })}>Remove line</button></p>;
    })}</details>}
  </section>;
}
