import { blockMinimum, designArea } from './cardDesign.js';

export const innerGrid = 8;
const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));

// Numeric editing and resizing keep the top-left corner anchored. Invalid
// inputs leave the geometry intact; no NaN/Infinity can reach saved layouts.
export function setBlockGeometry(block, patch, card) {
  const area = designArea(card), minimum = blockMinimum(block.type);
  const next = { ...block };
  for (const key of ['x','y','width','height']) if (Number.isFinite(patch[key])) next[key] = patch[key];
  next.x = clamp(next.x, 0, area.width-block.width);
  next.y = clamp(next.y, 0, area.height-block.height);
  next.width = clamp(next.width, minimum.width, area.width-next.x);
  next.height = clamp(next.height, minimum.height, area.height-next.y);
  return next;
}

const anchors = (start, size) => [start, start+size/2, start+size];

// Pointer snapping is separate from numeric/keyboard precision. Grid snapping
// happens first; a nearby edge/center guide can override it within five pixels.
// Resize guides affect only the trailing edge and never move the fixed corner.
export function dragBlock(block, dx, dy, card, { resize=false, grid=false, align=true, others=[] } = {}) {
  const area = designArea(card);
  const patch = resize ? { width: block.width+dx, height: block.height+dy } : { x: block.x+dx, y: block.y+dy };
  if (grid) {
    for (const [key, origin] of resize ? [['width',block.x],['height',block.y]] : [['x',0],['y',0]]) {
      patch[key] = Math.round((origin+patch[key])/innerGrid)*innerGrid-origin;
    }
  }
  let next = setBlockGeometry(block, patch, card);
  const guides = [];
  if (align) for (const [axis, key, size, limit] of [['x','x','width',area.width],['y','y','height',area.height]]) {
    const targets = [{ position:0, label:'Card edge' }, { position:limit/2, label:'Card center' }, { position:limit, label:'Card edge' }];
    others.filter(b => b.id !== block.id).forEach(b => anchors(b[key], b[size]).forEach((position,i) => targets.push({ position, label: i===1 ? 'Block center' : 'Block edge' })));
    const sources = resize ? [next[key]+next[size]] : anchors(next[key],next[size]);
    let best = null;
    for (const target of targets) for (const source of sources) {
      const delta = target.position-source;
      if (Math.abs(delta)>5 || (best && Math.abs(delta)>=Math.abs(best.delta))) continue;
      const proposed = setBlockGeometry(next, resize ? { [size]:next[size]+delta } : { [key]:next[key]+delta }, card);
      const actual = resize ? proposed[key]+proposed[size] : source+proposed[key]-next[key];
      // Half-pixel centers cannot always align on integer canvas coordinates.
      // Show a guide only if the final, bounded geometry actually matches it.
      if (Math.abs(actual-target.position)>.01) continue;
      best = { delta, proposed, axis, position:target.position, label:target.label };
    }
    if (best) { next=best.proposed; guides.push({ axis:best.axis, position:best.position, label:best.label }); }
  }
  return { block:next, guides };
}
