import test from 'node:test';
import assert from 'node:assert/strict';
import { alignBlocks, distributeBlocks, duplicateBlock, reorderBlock } from './blockArrange.js';
import { cleanLayout, commitHistory, createHistory, readLayoutLibrary, redoHistory, undoHistory } from './layout.js';

const card={id:'card',metric:'pts',x:20,y:40,width:600,height:500};
const block=(id,x,y=20,width=80,height=32)=>({id,type:'label',metric:'ftPct',scope:'b',label:'both',x,y,width,height});

test('duplicate retains size/bindings with a new ID, finds space and does not mutate its source',()=>{
  const blocks=[block('a',10)], before=structuredClone(blocks);
  const result=duplicateBlock(blocks,'a','copy',card);
  assert.equal(result.overlaps,false);assert.equal(result.blocks.length,2);
  const {id,x,y,...copy}=result.blocks[1], {id:oldId,x:oldX,y:oldY,...original}=blocks[0];
  assert.equal(id,'copy');assert.deepEqual(copy,original);assert.deepEqual(blocks,before);
  assert.equal(duplicateBlock(blocks,'a','a',card),null);
  const crowded=[block('a',0,0,258,106)];
  const fallback=duplicateBlock(crowded,'a','b',{...card,width:260,height:190});
  assert.equal(fallback.overlaps,true);assert.equal(fallback.blocks[1].x,0);assert.equal(fallback.blocks[1].y,0);
  const full=Array.from({length:10},(_,i)=>block(`cap${i}`,0,0));
  assert.equal(duplicateBlock(full,'cap0','extra',{...card,width:260,height:190}),null);
});

test('layer swaps are stable and bounded and never change a block definition',()=>{
  const blocks=[block('a',0),block('b',100),block('c',200)];
  assert.deepEqual(reorderBlock(blocks,'b','forward').map(b=>b.id),['a','c','b']);
  assert.deepEqual(reorderBlock(blocks,'b','backward').map(b=>b.id),['b','a','c']);
  assert.strictEqual(reorderBlock(blocks,'a','backward'),blocks);
  assert.strictEqual(reorderBlock(blocks,'c','forward'),blocks);
  assert.strictEqual(reorderBlock(blocks,'missing','forward'),blocks);
  assert.deepEqual(reorderBlock(reorderBlock(blocks,'b','forward'),'b','backward'),blocks);
});

test('all six alignments keep sizes/bindings and unselected blocks intact within the frame',()=>{
  const blocks=[block('a',20,10,80,32),block('b',200,100,120,64),block('other',400,300)];
  const ids=['a','b'];
  const left=alignBlocks(blocks,ids,'left',card);assert.equal(left[1].x,20);
  const right=alignBlocks(blocks,ids,'right',card);assert.equal(right[0].x+right[0].width,320);
  const cx=alignBlocks(blocks,ids,'centerX',card);assert.equal(cx[0].x+40,cx[1].x+60);
  const top=alignBlocks(blocks,ids,'top',card);assert.equal(top[1].y,10);
  const bottom=alignBlocks(blocks,ids,'bottom',card);assert.equal(bottom[0].y+32,164);
  const cy=alignBlocks(blocks,ids,'centerY',card);assert.equal(cy[0].y+16,cy[1].y+32);
  for(const aligned of [left,right,cx,top,bottom,cy]){
    assert.strictEqual(aligned[2],blocks[2]);
    aligned.forEach((b,i)=>{assert.equal(b.width,blocks[i].width);assert.equal(b.scope,'b');assert.equal(b.metric,'ftPct');assert(b.x>=0&&b.y>=0&&b.x+b.width<=598&&b.y+b.height<=416);});
  }
});

test('equal gaps preserve the selected outer edges with unequal sizes, rounding and no reordering',()=>{
  const blocks=[block('a',0,0,80,32),block('b',150,100,100,40),block('c',401,301,80,32),block('other',500,350)];
  const ids=['a','b','c'], horizontal=distributeBlocks(blocks,ids,'x',card).blocks;
  assert.equal(horizontal[0].x,0);assert.equal(horizontal[2].x+80,481);
  assert(Math.abs((horizontal[1].x-80)-(horizontal[2].x-horizontal[1].x-100))<=1);
  const vertical=distributeBlocks(blocks,ids,'y',card).blocks;
  assert.equal(vertical[0].y,0);assert.equal(vertical[2].y+32,333);
  assert(Math.abs((vertical[1].y-32)-(vertical[2].y-vertical[1].y-40))<=1);
  assert.strictEqual(horizontal[3],blocks[3]);assert.deepEqual(horizontal.map(b=>b.id),blocks.map(b=>b.id));
});

test('insufficient spacing/selection leaves the arrangement unchanged with an explanation',()=>{
  const blocks=[block('a',0),block('b',20),block('c',40)];
  const crowded=distributeBlocks(blocks,['a','b','c'],'x',card);
  assert.strictEqual(crowded.blocks,blocks);assert.match(crowded.reason,/Not enough room/);
  assert.strictEqual(distributeBlocks(blocks,['a','b'],'x',card).blocks,blocks);
  assert.strictEqual(alignBlocks(blocks,['a'],'left',card),blocks);
});

test('duplication, alignment and paint order survive one Apply/Undo/Redo and named-layout reopening',()=>{
  const base=cleanLayout({cards:[{...card,blocks:[block('a',0),block('b',200)]}]});
  let blocks=duplicateBlock(base.cards[0].blocks,'a','copy',card).blocks;
  blocks=alignBlocks(blocks,['a','copy'],'left',card);blocks=reorderBlock(blocks,'copy','backward');
  let h=commitHistory(createHistory(base),{...base,cards:[{...card,blocks}]});
  assert.equal(h.past.length,1);assert.deepEqual(undoHistory(h).present,base);h=redoHistory(undoHistory(h));
  const saved=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...h.present}]})})[0];
  assert.deepEqual(saved.cards[0].blocks,blocks);assert.equal(saved.selection,undefined);
});
