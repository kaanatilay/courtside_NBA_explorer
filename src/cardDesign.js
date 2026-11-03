import { fullGameMetrics, percentagePairs } from './catalog.js';
import { average } from './stats.js';
import { shootingMetric } from './shootingChart.js';

export const blockTypes = ['value', 'label', 'bar', 'vertical', 'donut'];
export const blockTypeLabels = { value:'Statistic value', label:'Team / statistic label', bar:'Horizontal comparison bars', vertical:'Vertical comparison bars', donut:'Shooting makes / misses donut' };
export const metricLabel = key => fullGameMetrics.find(([id]) => id === key)?.[1] || key;
export const formatValue = (value, metric, decimals=1) => !Number.isFinite(value) ? '—' : `${value.toFixed(Number.isInteger(decimals)&&decimals>=0&&decimals<=3?decimals:1)}${percentagePairs[metric] ? '%' : ''}`;

// Coordinates belong to the card's interior, below its 42px header and above
// its 40px actions. Borders take two pixels. Saved blocks never contain values.
export const designArea = card => ({ width: (card.width || 260)-2, height: (card.height || 190)-84 });
export const blockMinimum = type => type === 'label' ? { width: 80, height: 32 }
  : type === 'bar' ? { width: 160, height: 80 } : type === 'vertical' ? { width:160, height:120 } : type==='donut' ? {width:240,height:180} : { width: 160, height: 64 };
export const blockCapacity = card => Math.min(100, Math.floor(designArea(card).width * designArea(card).height / (80*32)));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Clamp a move/resize into its current interior. A block can overlap another,
// but cannot escape the frame. Minimum sizes depend on its content type.
export function fitBlock(block, card) {
  const area = designArea(card), min = blockMinimum(block.type);
  const width = clamp(Math.round(block.width), Math.min(min.width, area.width), area.width);
  const height = clamp(Math.round(block.height), Math.min(min.height, area.height), area.height);
  return { ...block, width, height, x: clamp(Math.round(block.x), 0, area.width-width), y: clamp(Math.round(block.y), 0, area.height-height) };
}

// Missing blocks means a legacy card. An explicit [] is a deliberately empty
// custom design. Reject invalid bindings/geometry and strip arbitrary fields.
export function cleanBlocks(value, card) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  return value.filter(b => {
    if (!b || typeof b.id !== 'string' || !b.id || seen.has(b.id) || !blockTypes.includes(b.type)
      || !fullGameMetrics.some(([id]) => id === b.metric) || (b.type==='donut'&&!['ftPct','tpPct'].includes(b.metric)) || !['x','y','width','height'].every(k => Number.isFinite(b[k]))) return false;
    seen.add(b.id); return true;
  }).slice(0, 100).map(b => fitBlock({ id: b.id, type: b.type, metric: b.metric,
    scope: ['a','b','both'].includes(b.scope) ? b.scope : 'both',
    label: ['team','stat','both'].includes(b.label) ? b.label : 'both',
    x: b.x, y: b.y, width: b.width, height: b.height,
    ...(typeof b.showLabel==='boolean'?{showLabel:b.showLabel}:{}),
    ...(typeof b.showValue==='boolean'?{showValue:b.showValue}:{}),
    ...(Number.isInteger(b.decimals)&&b.decimals>=0&&b.decimals<=3?{decimals:b.decimals}:{}) }, card));
}

export function initialBlocks(card) {
  if (Array.isArray(card.blocks)) return cleanBlocks(card.blocks, card);
  const area = designArea(card);
  return [fitBlock({ id: 'initial-values', type: 'value', metric: card.metric, scope: 'both', label: 'both',
    x: 8, y: 8, width: Math.min(320, area.width-16), height: 64 }, card)];
}

// Place another block in free space, using the smallest valid frame. The
// available interior determines capacity; a full frame asks for outer resizing.
export function addDesignBlock(blocks, card, type, id) {
  if (!blockTypes.includes(type) || blocks.length >= blockCapacity(card)) return null;
  const area = designArea(card), size = blockMinimum(type);
  if (size.width > area.width || size.height > area.height) return null;
  for (let y=0; y<=area.height-size.height; y+=8) for (let x=0; x<=area.width-size.width; x+=8) {
    if (blocks.some(b => x < b.x+b.width && x+size.width > b.x && y < b.y+b.height && y+size.height > b.y)) continue;
    return [...blocks, { id, type, metric: type==='donut'?(shootingMetric(card.metric)||'ftPct'):card.metric, scope: 'both', label: type === 'label' ? 'stat' : 'both', x, y, ...size }];
  }
  return null;
}

// Keep the contents intact when the outer card shrinks or a magnet proposes a
// matched size. Resizing cannot silently delete or clip already-applied blocks.
export function contentMinimum(card) {
  const blocks = Array.isArray(card.blocks) ? card.blocks : [];
  return { width: Math.max(260, ...blocks.map(b => b.x+b.width+2)),
    height: Math.max(190, ...blocks.map(b => b.y+b.height+84)) };
}
export const designFits = card => {
  const min = contentMinimum(card);
  return card.width >= min.width && card.height >= min.height;
};

// Team bindings use selection slots, so swapping teams/filtering updates values
// without changing the saved design. Preserve missing-aware sample calculations.
export function blockValues(block, rows) {
  const slots = block.scope === 'a' ? [0] : block.scope === 'b' ? [1] : [0,1];
  return slots.map(slot => ({ slot, value: average(rows[slot] || [], block.metric), games: rows[slot]?.length || 0 }));
}
export function comparisonWidths(values) {
  if (values.some(v => !Number.isFinite(v) || v < 0)) return values.map(() => null);
  const max = Math.max(...values);
  return values.map(value => max > 0 ? value/max*100 : 0);
}
