import { shootingMetric, shootingMetrics } from './shootingChart.js';
import { cardPurposes, cleanPurpose, purposeBlocks } from './cardPurpose.js';
import React, { useEffect, useRef, useState } from 'react';
import { fullGameMetrics } from './catalog.js';
import { addDesignBlock, blockMinimum, blockTypeLabels, blockTypes, cleanBlocks, designArea, fitBlock, initialBlocks, metricLabel } from './cardDesign.js';
import { cleanTemplate, loadTemplate, readTemplates, templateStorageKey } from './cardTemplates.js';
import { dragBlock, innerGrid, setBlockGeometry } from './blockGeometry.js';
import { alignBlocks, distributeBlocks, duplicateBlock, reorderBlock } from './blockArrange.js';
import { BlockContent } from './CardContent.jsx';
import ColorControl from './ColorControl.jsx';
import ContrastFeedback from './ContrastFeedback.jsx';
import { backgroundPresets, borderPresets, cardColorStyles, cleanCardAppearance, defaultColors } from './appearance.js';

// Keep typed text local until blur/Enter, so clearing a field to type a new
// number does not jump the block. Escape reverts only that field.
function GeometryField({ name, value, min, max, onCommit }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return <label>{name}<input type="number" step="1" min={min} max={max} value={text}
    title={`Allowed ${min}–${max}. Enter or leave field to apply; Escape reverts.`}
    onChange={e => setText(e.target.value)}
    onBlur={() => { const n = text.trim()==='' ? NaN : Number(text); onCommit(n); setText(String(Number.isFinite(n) ? Math.max(min,Math.min(max,Math.round(n))) : value)); }}
    onKeyDown={e => {
      if (e.key==='Enter') { e.preventDefault(); e.currentTarget.blur(); }
      if (e.key==='Escape') { e.preventDefault(); setText(String(value)); }
    }} /></label>;
}

// The modal owns a disposable working design; the workspace only receives an
// applied result. Native dialog supplies focus trapping and background inertness.
export default function CardEditor({ card:originalCard, otherCards=[], ids, rows, loading, error, onApply, onCancel }) {
  // Outer dimensions join the disposable draft so Cancel restores everything,
  // while Apply can commit template size and contents in a single history entry.
  const [frame,setFrame]=useState(()=>({width:originalCard.width,height:originalCard.height}));
  const [appearance,setAppearance]=useState(()=>cleanCardAppearance(originalCard.appearance)||{});
  const [purpose,setPurpose]=useState(()=>({purpose:'flexible',teamSlot:'a',...cleanPurpose(originalCard)}));
  const card={...originalCard,...frame,...purpose};
  const [blocks, setBlocks] = useState(() => initialBlocks(card));
  const [selected, setSelected] = useState(() => initialBlocks(card)[0]?.id || '');
  const [selection, setSelection] = useState(() => initialBlocks(card).slice(0,1).map(b=>b.id));
  const [alignment, setAlignment] = useState('left');
  const [type, setType] = useState('label');
  const [message, setMessage] = useState('Select a block. Drag Move/Resize, or enter exact coordinates. Arrows adjust 1 px; Shift+arrows adjust 8 px.');
  const [grid, setGrid] = useState(false);
  const [align, setAlign] = useState(true);
  const [guides, setGuides] = useState([]);
  const [templates,setTemplates]=useState(()=>{try{return readTemplates(localStorage);}catch{return [];}});
  const [templateId,setTemplateId]=useState('');
  const [templateName,setTemplateName]=useState('');
  const [useTemplateSize,setUseTemplateSize]=useState(true);
  const dialog = useRef(null), gesture = useRef(null);
  const area = designArea(card), current = blocks.find(b => b.id === selected);
  const currentIndex=blocks.findIndex(b=>b.id===selected);
  const overlaps=otherCards.filter(c=>card.x<c.x+c.width&&card.x+card.width>c.x&&card.y<c.y+c.height&&card.y+card.height>c.y);
  const footprint=[card,...overlaps];
  const previewX=Math.min(...footprint.map(c=>c.x))-20, previewY=Math.min(...footprint.map(c=>c.y))-20;
  const previewWidth=Math.max(...footprint.map(c=>c.x+c.width))-previewX+20, previewHeight=Math.max(...footprint.map(c=>c.y+c.height))-previewY+20;

  useEffect(() => {
    const node = dialog.current; node.showModal();
    return () => { node.close(); };
  }, []);

  // Template saves are explicit library writes, independent of Apply/Cancel.
  // Loading only changes the disposable draft; original named layouts stay safe.
  function saveTemplate(copy=false) {
    if(!templateName.trim()){setMessage('Enter a template name first.');return;}
    if((copy||!templateId)&&templates.length>=50){setMessage('This browser supports up to 50 card templates. Update a selected template instead.');return;}
    const record=cleanTemplate({id:!copy&&templateId?templateId:crypto.randomUUID(),name:templateName,width:card.width,height:card.height,...purpose,blocks:purposeBlocks(blocks,purpose),appearance:cleanCardAppearance(appearance)||{}});
    const next=[...templates.filter(t=>t.id!==record.id),record];
    try {localStorage.setItem(templateStorageKey,JSON.stringify({version:1,templates:next}));setTemplates(next);setTemplateId(record.id);setTemplateName(record.name);setMessage(`Template “${record.name}” saved in this browser. Cancel card edit does not undo template saves.`);}
    catch {setMessage('Could not save templates in this browser. Your working design remains open.');}
  }
  function openTemplate() {
    const result=loadTemplate(templates.find(t=>t.id===templateId),card,()=>crypto.randomUUID(),{useTemplateSize});
    if(result.blocks){setPurpose({purpose:'flexible',teamSlot:'a',...cleanPurpose(result)});setFrame({width:result.width,height:result.height});if(Object.hasOwn(result,'appearance'))setAppearance(result.appearance);setBlocks(result.blocks);setSelected(result.blocks[0]?.id||'');setSelection(result.blocks.slice(0,1).map(b=>b.id));setGuides([]);}
    setMessage(result.reason);
  }

  // The active block owns the property fields. The arrangement selection is
  // explicit: checkboxes/modifier-click add/remove members without editing data.
  function selectBlock(id, additive=false) {
    const next=additive ? (selection.includes(id)?selection.filter(key=>key!==id):[...selection,id]) : id?[id]:[];
    setSelection(next);setSelected(next.includes(id)?id:next.at(-1)||'');setGuides([]);
  }
  function focusBlock(id) {
    setSelected(id);if(!selection.includes(id))setSelection([id]);
  }
  function duplicate() {
    const id=crypto.randomUUID(), result=duplicateBlock(blocks,selected,id,card);
    if(!result){setMessage('Cannot duplicate: no active block or this frame has reached its block capacity.');return;}
    setBlocks(result.blocks);setSelected(id);setSelection([id]);setGuides([]);
    setMessage(result.overlaps?'Duplicate added at the front. It overlaps another block; move it or adjust layer order.':'Independent duplicate added at the front in free space.');
  }
  function arrange(kind) {
    setGuides([]);
    if(kind==='align'){setBlocks(alignBlocks(blocks,selection,alignment,card));setMessage('Selected blocks aligned within their combined bounds; individual sizes kept.');}
    else {const result=distributeBlocks(blocks,selection,kind,card);setBlocks(result.blocks);setMessage(result.reason);}
  }

  function change(patch) {
    setGuides([]);
    setBlocks(list => list.map(b => b.id === selected ? fitBlock(purposeBlocks([{ ...b, ...patch }],purpose)[0], card) : b));
  }
  function geometry(key, value) {
    setGuides([]);
    if (!Number.isFinite(value)) { setMessage('Enter a finite number; the previous value was kept.'); return; }
    const next=setBlockGeometry(current,{ [key]:value },card);
    setBlocks(list => list.map(b => b.id===selected ? next : b));
    setMessage(next[key]===value ? 'Exact geometry applied to the preview.' : `Limited to the frame/type bounds: ${key} = ${next[key]} px.`);
  }
  function add() {
    const id = crypto.randomUUID(), next = addDesignBlock(blocks, card, type, id);
    if (!next) { setMessage('No free room for this block. Resize or remove existing blocks, or Cancel and enlarge the outer card first.'); return; }
    setBlocks(purposeBlocks(next,purpose)); setSelected(id); setSelection([id]); setMessage('Block added. Choose its statistic and team binding below.');
  }
  function start(e, block, resize) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    focusBlock(block.id);
    setGuides([]);
    gesture.current = { block, resize, x: e.clientX, y: e.clientY, scroll: e.currentTarget.closest('.card-editor-scroll'),
      scrollX:e.currentTarget.closest('.card-editor-scroll').scrollLeft, scrollY:e.currentTarget.closest('.card-editor-scroll').scrollTop };
  }
  function move(e) {
    const g = gesture.current; if (!g) return;
    const dx = Math.round(e.clientX-g.x+g.scroll.scrollLeft-g.scrollX), dy = Math.round(e.clientY-g.y+g.scroll.scrollTop-g.scrollY);
    const result = dragBlock(g.block,dx,dy,card,{ resize:g.resize, grid, align, others:blocks });
    const next=result.block; setGuides(result.guides);
    setBlocks(list => list.map(b => b.id === next.id ? next : b));
  }
  function end(e) {
    const g = gesture.current; gesture.current = null;
    setGuides([]);
    if (g && e.type === 'pointercancel') setBlocks(list => list.map(b => b.id === g.block.id ? g.block : b));
    else if (g) setMessage('Pointer adjustment complete. Use numeric fields or arrows for exact positioning.');
  }
  function byKey(e, block, resize) {
    const step = e.shiftKey ? innerGrid : 1;
    const directions = { ArrowLeft: [-step,0], ArrowRight: [step,0], ArrowUp: [0,-step], ArrowDown: [0,step] };
    if (!directions[e.key]) return; e.preventDefault();
    const [dx,dy] = directions[e.key]; focusBlock(block.id);
    const next = setBlockGeometry(block, resize ? { width:block.width+dx, height:block.height+dy } : { x:block.x+dx, y:block.y+dy }, card);
    setGuides([]); setMessage(`Keyboard ${resize ? 'resize' : 'move'} · ${step} px step · X ${next.x}, Y ${next.y}, ${next.width} × ${next.height}.`);
    setBlocks(list => list.map(b => b.id === block.id ? next : b));
  }
  return <dialog ref={dialog} className="card-editor" aria-labelledby="card-editor-title"
    onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={e => e.stopPropagation()}>
    <div className="card-editor-heading"><div><h2 id="card-editor-title">Edit card · {metricLabel(card.metric)}</h2><p>Card {card.width} × {card.height} · Interior {area.width} × {area.height} · current filtered sample · {loading ? 'loading' : error ? 'unavailable' : 'live preview'}</p></div>
      <div><button className="close-button" onClick={onCancel}>Cancel card edit</button><button className="close-button" onClick={() => { if (!gesture.current) onApply(purposeBlocks(cleanBlocks(blocks, card),purpose),{...frame,purpose:purpose.purpose==='flexible'?undefined:purpose.purpose,teamSlot:purpose.purpose==='flexible'?undefined:purpose.teamSlot,appearance:cleanCardAppearance(appearance)||undefined}); }}>Apply card design</button></div></div>
    <section className="card-editor-arrangement" aria-label="Card purpose and data">
      <h3>Card purpose and data</h3>
      <div className="card-editor-tools">
        <label>Card purpose<select value={purpose.purpose} onChange={e=>{const next={...purpose,purpose:e.target.value};setPurpose(next);setBlocks(list=>purposeBlocks(list,next));}}>{Object.entries(cardPurposes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {['single','related'].includes(purpose.purpose)&&<label>Card team<select value={purpose.teamSlot} onChange={e=>{const next={...purpose,teamSlot:e.target.value};setPurpose(next);setBlocks(list=>purposeBlocks(list,next));}}><option value="a">Team A · {ids[0]}</option><option value="b">Team B · {ids[1]}</option></select></label>}
      </div>
      <p className="card-editor-note">{purpose.purpose==='flexible'?'Each block keeps its own team binding. Existing designs open in this mode.':purpose.purpose==='comparison'?'Each block compares the same statistic across Team A and Team B. Select the statistic per block.':purpose.purpose==='related'?'Combine related statistics for the selected team: for example, free throws made, attempted and percentage. Choose each block statistic below.':'All blocks follow the selected team. Numbers give the clearest individual values.'} Team A/B follow your main team selections; swapping teams updates this design.</p>
      <p className="card-editor-note">Season, quarter and game-sample filters come from the main interface, not this design. Counts are per-game sample averages; shooting percentages use summed makes/attempts. Missing data stays unavailable. Donut counts are sample totals, rather than per-game averages. Purpose changes update all block team bindings; returning to Flexible keeps those updated bindings. Cancel restores the original design.</p>
    </section>
    <details className="card-editor-arrangement"><summary>Card colors</summary>
      <ColorControl label="Card background" value={appearance.background||defaultColors.cardBackground} presets={backgroundPresets} onChange={background=>setAppearance(a=>({...a,background}))} onReset={()=>setAppearance(a=>{const next={...a};delete next.background;return next;})} />
      <ColorControl label="Card border" value={appearance.border||defaultColors.cardBorder} presets={borderPresets} onChange={border=>setAppearance(a=>({...a,border}))} onReset={()=>setAppearance(a=>{const next={...a};delete next.border;return next;})} />
      <button className="close-button" onClick={()=>setAppearance({})}>Reset all card colors</button>
      <ContrastFeedback background={appearance.background} border={appearance.border} onReadableBorder={border=>setAppearance(a=>({...a,border}))} />
      <p className="card-editor-note">Preview below; Apply/Cancel includes colors. Text and bar colors adapt automatically to custom backgrounds. Card templates now save these appearance settings too.</p>
    </details>
    <details className="card-editor-arrangement"><summary>Card templates · {templates.length} saved</summary>
      <div className="card-editor-tools">
        <label>Saved card template<select value={templateId} onChange={e=>{setTemplateId(e.target.value);setTemplateName(templates.find(t=>t.id===e.target.value)?.name||'');}}><option value="">New template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Template size<select value={useTemplateSize?'template':'current'} onChange={e=>setUseTemplateSize(e.target.value==='template')}><option value="template">Use template card size</option><option value="current">Keep current card size</option></select></label>
        <button className="close-button" disabled={!templateId} onClick={openTemplate}>Load template</button>
        <label>Template name<input maxLength={80} value={templateName} onChange={e=>setTemplateName(e.target.value)} /></label>
        <button className="close-button" onClick={()=>saveTemplate(false)}>Save template</button>
        <button className="close-button" disabled={!templateId} onClick={()=>saveTemplate(true)}>Save template copy</button>
      </div><p className="card-editor-note">Load replaces this working draft, including saved colors. Legacy templates without color settings keep current colors. By default it restores the saved card size; Keep current card size checks fit. Cancel restores size, design and colors. Each load is independent. Template saves happen immediately and survive Cancel; Apply and workspace Save are separate.</p>
    </details>
    {overlaps.length>0&&<div className="card-editor-overlap" role="region" aria-label="Card size overlap preview">
      <p>This frame overlaps {overlaps.length} other card(s). Green is the edited card; orange shows overlaps. Apply preserves positions and group membership; rearrange in the workspace afterward if needed.</p>
      <svg viewBox={`${previewX} ${previewY} ${previewWidth} ${previewHeight}`} role="img" aria-label="Preview of card frame and overlapping neighbors">
        {overlaps.map(c=><rect key={c.id} x={c.x} y={c.y} width={c.width} height={c.height} fill="#ebaa6855" stroke="#ebaa68"><title>{metricLabel(c.metric)}</title></rect>)}
        <rect x={card.x} y={card.y} width={card.width} height={card.height} fill="#bada8855" stroke="#bada88"><title>Edited card: {card.width} × {card.height}</title></rect>
      </svg>
    </div>}
    <div className="card-editor-tools"><label>New block type<select value={type} onChange={e => setType(e.target.value)}>{blockTypes.map(type => <option key={type} value={type}>{blockTypeLabels[type]}</option>)}</select></label><button className="close-button" onClick={add}>Add inner block</button>
      <label>Selected block<select value={selected} onChange={e => selectBlock(e.target.value)}><option value="">Select a block</option>{blocks.map((b,i) => <option key={b.id} value={b.id}>Block {i+1} · {b.type} · {metricLabel(b.metric)}</option>)}</select></label>
    </div>
    {current && <div className="card-editor-tools">
      <label>Block visualization<select value={current.type} onChange={e=>change({type:e.target.value,...(e.target.value==='donut'?{metric:shootingMetric(current.metric)||'ftPct'}:{})})}>{blockTypes.map(type=><option key={type} value={type} disabled={blockMinimum(type).width>area.width||blockMinimum(type).height>area.height}>{blockTypeLabels[type]}{blockMinimum(type).height>area.height?' (enlarge card)':''}</option>)}</select></label>
      <label>Block statistic<select value={current.metric} onChange={e => change({ metric: e.target.value })}>{(current.type==='donut'?shootingMetrics:fullGameMetrics).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Block team<select disabled={purpose.purpose!=='flexible'} value={current.scope} onChange={e => change({ scope: e.target.value })}><option value="a">Team A · {ids[0]}</option><option value="b">Team B · {ids[1]}</option><option value="both">Both teams</option></select></label>
      {current.type === 'label' && <label>Label content<select value={current.label} onChange={e => change({ label: e.target.value })}><option value="team">Team</option><option value="stat">Statistic</option><option value="both">Team + statistic</option></select></label>}
      <button className="close-button" onClick={duplicate}>Duplicate block</button>
      <button className="close-button" disabled={currentIndex===blocks.length-1} onClick={() => { setBlocks(reorderBlock(blocks,selected,'forward')); setGuides([]);setMessage('Active block moved forward one layer.'); }}>Bring forward</button>
      <button className="close-button" disabled={currentIndex===0} onClick={() => { setBlocks(reorderBlock(blocks,selected,'backward')); setGuides([]);setMessage('Active block moved backward one layer.'); }}>Send backward</button>
      <button className="close-button" onClick={() => { const next=selection.filter(id=>id!==selected);setBlocks(list => list.filter(b => b.id !== selected));setSelection(next);setSelected(next.at(-1)||'');setGuides([]); }}>Remove selected block</button>
      <span className="card-editor-position">{current.x}, {current.y} · {current.width} × {current.height}</span>
    </div>}
    {current&&current.type!=='label'&&<div className="card-editor-tools card-editor-format">
      <label className="card-editor-check"><input type="checkbox" checked={current.showLabel!==false} onChange={e=>change({showLabel:e.target.checked})} /> Show labels</label>
      <label className="card-editor-check"><input type="checkbox" checked={current.showValue!==false} onChange={e=>change({showValue:e.target.checked})} /> Show values</label>
      <label>Decimal places<select value={current.decimals??1} onChange={e=>change({decimals:Number(e.target.value)})}>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <p className="card-editor-note">{current.type==='donut'?'Donuts show makes and misses as parts of total attempts, separately for each team. Counts are sample TOTALS, not per-game averages. Missing games invalidate the sample; no attempts means no donut.':current.type==='value'?'Numbers suit an individual team or exact comparison.':`Bars suit magnitude comparisons. ${current.scope==='both'?'Both teams share a scale relative to the larger shown value.':'A single-team bar is relative to itself; use a number for clearer individual context.'}`} {current.type!=='donut'&&current.metric.endsWith('Pct')?'Shooting percentages use summed makes/attempts; bar lengths remain relative, not a fixed 0–100% axis.':''} {current.showLabel===false&&current.showValue===false?'Labels and values are hidden; hover for the metric/value.':''}</p>
    </div>}
    <details className="card-editor-arrangement">
      <summary>Arrange blocks · {selection.length} selected</summary>
      <p className="card-editor-note">Check blocks below, or Shift/Ctrl/Cmd-click their previews. Property fields edit the active block only; Move/Resize handles also adjust one block. Layer order is back → front.</p>
      <div className="card-editor-selection">
        {blocks.map((b,i)=><label key={b.id} className="card-editor-check"><input type="checkbox" checked={selection.includes(b.id)} onChange={()=>selectBlock(b.id,true)} />{i+1} · {b.type} · {metricLabel(b.metric)}{b.id===selected?' (active)':''}</label>)}
      </div>
      <div className="card-editor-tools">
        <button className="close-button" disabled={!blocks.length} onClick={()=>{setSelection(blocks.map(b=>b.id));setSelected(selected||blocks[0].id);setGuides([]);}}>Select all blocks</button>
        <button className="close-button" disabled={!selection.length} onClick={()=>selectBlock('')}>Clear selection</button>
        <label>Align selected blocks<select value={alignment} onChange={e=>setAlignment(e.target.value)}><option value="left">Left edges</option><option value="centerX">Horizontal centers</option><option value="right">Right edges</option><option value="top">Top edges</option><option value="centerY">Vertical centers</option><option value="bottom">Bottom edges</option></select></label>
        <button className="close-button" disabled={selection.length<2} onClick={()=>arrange('align')}>Align blocks</button>
        <button className="close-button" disabled={selection.length<3} onClick={()=>arrange('x')}>Equal horizontal gaps</button>
        <button className="close-button" disabled={selection.length<3} onClick={()=>arrange('y')}>Equal vertical gaps</button>
      </div>
      <p className="card-editor-note">Alignment uses the selected bounds. Equal gaps keep their outer edges; insufficient space leaves positions unchanged. Overlap is allowed for alignment.</p>
    </details>
    <div className="card-editor-tools card-editor-geometry">
      <label className="card-editor-check"><input type="checkbox" checked={grid} onChange={e => { setGrid(e.target.checked); setGuides([]); }} /> Snap to 8 px grid</label>
      <label className="card-editor-check"><input type="checkbox" checked={align} onChange={e => { setAlign(e.target.checked); setGuides([]); }} /> Alignment guides</label>
      {current && <>
        <GeometryField key={`${selected}-x`} name="X" value={current.x} min={0} max={area.width-current.width} onCommit={v => geometry('x',v)} />
        <GeometryField key={`${selected}-y`} name="Y" value={current.y} min={0} max={area.height-current.height} onCommit={v => geometry('y',v)} />
        <GeometryField key={`${selected}-w`} name="Width" value={current.width} min={blockMinimum(current.type).width} max={area.width-current.x} onCommit={v => geometry('width',v)} />
        <GeometryField key={`${selected}-h`} name="Height" value={current.height} min={blockMinimum(current.type).height} max={area.height-current.y} onCommit={v => geometry('height',v)} />
      </>}
    </div>
    {current && <p className="card-editor-note">Block {blocks.findIndex(b => b.id===selected)+1} selected · minimum {blockMinimum(current.type).width} × {blockMinimum(current.type).height} px · position measured from the interior's top-left. Numeric fields and keyboard bypass snapping. Guides may override the grid within 5 px.</p>}
    <p className="card-editor-note" role="status">{message}</p>
    <p className="card-editor-note">Number/bar counts are sample averages; donut counts are sample totals. Shooting percentages use total makes/attempts. Bar lengths are relative to the largest shown team value. Missing/loading data has no bar. Apply changes the open layout; use Save afterward to keep it.</p>
    <div className="card-editor-scroll"><div className="card-editor-canvas" style={{ width: area.width, height: area.height,...cardColorStyles(appearance) }}>
      {!blocks.length && <span className="card-design-empty">Blank interior · add a block above</span>}
      {blocks.map((block,index) => <div key={block.id} className={`card-design-block card-editor-block ${selection.includes(block.id) ? 'batch-selected' : ''} ${block.id === selected ? 'selected' : ''}`} style={{ left: block.x, top: block.y, width: block.width, height: block.height }} onClick={e => { if(e.target.closest('button'))return;selectBlock(block.id,e.shiftKey||e.ctrlKey||e.metaKey); }}>
        <BlockContent block={block} ids={ids} rows={rows} loading={loading} error={error} />
        <button className="card-editor-move" aria-label={`Move inner block ${index+1}`} title="Drag to move; arrows 1 px, Shift+arrows 8 px" onFocus={() => focusBlock(block.id)} onPointerDown={e => start(e,block,false)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={e => byKey(e,block,false)}>⠿ {index+1}</button>
        <button className="card-editor-resize" aria-label={`Resize inner block ${index+1}`} title="Drag to resize; arrows 1 px, Shift+arrows 8 px" onFocus={() => focusBlock(block.id)} onPointerDown={e => start(e,block,true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={e => byKey(e,block,true)}>↘</button>
      </div>)}
      {guides.map(g => <div key={g.axis} className={`card-editor-guide guide-${g.axis}`} style={g.axis==='x' ? { left:g.position } : { top:g.position }}><span>{g.label}</span></div>)}
    </div></div>
  </dialog>;
}
