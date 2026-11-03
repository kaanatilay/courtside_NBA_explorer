import React, { useEffect, useState } from 'react';
import { cleanColor } from './appearance.js';

// Native color input opens the platform picker; a hex field also supports exact
// keyboard entry. Parent draft state controls preview/Apply/Cancel semantics.
export default function ColorControl({ label, value, presets, onChange, onReset }) {
  const [text,setText]=useState(value), [error,setError]=useState('');
  useEffect(()=>{setText(value);setError('');},[value]);
  const selected=presets.some(([,color])=>color===value)?value:'custom';
  return <div className="color-control">
    <label>{label} preset<select value={selected} onChange={e=>{if(e.target.value!=='custom')onChange(e.target.value);}}>
      {presets.map(([name,color])=><option key={name} value={color}>{name}</option>)}<option value="custom" disabled>Custom (picker/hex)</option>
    </select></label>
    <label>{label} picker<input type="color" value={value} onChange={e=>onChange(e.target.value)} /></label>
    <label>{label} hex<input type="text" value={text} maxLength={7} spellCheck={false} aria-invalid={!!error} onChange={e=>setText(e.target.value)}
      onBlur={()=>{const color=cleanColor(text);if(color){onChange(color);setError('');setText(color);}else{setText(value);setError('Use #RRGGBB; the previous color was kept.');}}}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();setText(value);setError('');}}} /></label>
    <button className="close-button" onClick={()=>{onReset();setText(value);setError('');}}>Reset {label.toLowerCase()}</button>
    {error&&<span className="color-control-error" role="status">{error}</span>}
  </div>;
}
