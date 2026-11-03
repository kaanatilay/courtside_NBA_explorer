import { blockCapacity, designArea, fitBlock } from './cardDesign.js';
import { setBlockGeometry } from './blockGeometry.js';

const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;

// Copies get their own identity and retain data bindings/size. Prefer a free
// slot; when the frame is crowded use a bounded offset and report the overlap.
export function duplicateBlock(blocks, id, newId, card) {
  const source = blocks.find(b => b.id===id);
  if (!source || !newId || blocks.some(b=>b.id===newId) || blocks.length>=blockCapacity(card)) return null;
  const area=designArea(card);
  let copy=fitBlock({...source,id:newId,x:source.x+16,y:source.y+16},card);
  if (blocks.some(b=>overlaps(copy,b))) {
    search: for(let y=0;y<=area.height-copy.height;y+=8) for(let x=0;x<=area.width-copy.width;x+=8) {
      const candidate={...copy,x,y};
      if (!blocks.some(b=>overlaps(candidate,b))) { copy=candidate; break search; }
    }
  }
  return { blocks:[...blocks,copy], overlaps:blocks.some(b=>overlaps(copy,b)) };
}

// Array order is the paint order in both renderers and in saved definitions.
// Swap only neighboring layers; never change IDs, bindings or positions.
export function reorderBlock(blocks, id, direction) {
  const index=blocks.findIndex(b=>b.id===id), next=index+(direction==='forward'?1:direction==='backward'?-1:0);
  if(index<0 || next<0 || next>=blocks.length || next===index)return blocks;
  const result=[...blocks];[result[index],result[next]]=[result[next],result[index]];return result;
}

// Align to the selected envelope, leaving all unselected blocks untouched.
// Pixel rounding can leave at most half a pixel between unequal-width centers.
export function alignBlocks(blocks, ids, kind, card) {
  const chosen=blocks.filter(b=>ids.includes(b.id));
  if(chosen.length<2 || !['left','centerX','right','top','centerY','bottom'].includes(kind))return blocks;
  const x=Math.min(...chosen.map(b=>b.x)), right=Math.max(...chosen.map(b=>b.x+b.width));
  const y=Math.min(...chosen.map(b=>b.y)), bottom=Math.max(...chosen.map(b=>b.y+b.height));
  return blocks.map(b=>{
    if(!ids.includes(b.id))return b;
    const patch=kind==='left'?{x}:kind==='right'?{x:right-b.width}:kind==='centerX'?{x:(x+right-b.width)/2}
      :kind==='top'?{y}:kind==='bottom'?{y:bottom-b.height}:{y:(y+bottom-b.height)/2};
    return setBlockGeometry(b,patch,card);
  });
}

// Keep the envelope's outer edges; distribute nonnegative edge-to-edge gaps,
// not center spacing. If blocks cannot fit, leave the design intact and explain.
export function distributeBlocks(blocks, ids, axis, card) {
  const chosen=blocks.filter(b=>ids.includes(b.id));
  if(chosen.length<3 || !['x','y'].includes(axis))return {blocks,reason:'Select at least three blocks to distribute.'};
  const size=axis==='x'?'width':'height';chosen.sort((a,b)=>a[axis]-b[axis]);
  const start=chosen[0][axis], end=Math.max(...chosen.map(b=>b[axis]+b[size]));
  const gap=(end-start-chosen.reduce((sum,b)=>sum+b[size],0))/(chosen.length-1);
  if(gap<0)return {blocks,reason:'Not enough room for non-overlapping equal gaps. Spread the outer blocks farther apart or shrink them first.'};
  let cursor=start;const positions=new Map();
  chosen.forEach(b=>{positions.set(b.id,Math.round(cursor));cursor+=b[size]+gap;});
  return {blocks:blocks.map(b=>positions.has(b.id)?setBlockGeometry(b,{[axis]:positions.get(b.id)},card):b),reason:'Equal gaps applied (rounded to whole pixels); outer edges kept.'};
}
