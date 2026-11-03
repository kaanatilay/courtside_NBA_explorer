import test from 'node:test';
import assert from 'node:assert/strict';
import { dragBlock, setBlockGeometry } from './blockGeometry.js';
import { cleanLayout, commitHistory, createHistory, readLayoutLibrary, undoHistory } from './layout.js';

const card = { id:'card', metric:'pts', x:20, y:40, width:500, height:400 };
const block = { id:'a', type:'label', metric:'pts', scope:'both', label:'stat', x:10, y:20, width:80, height:32 };

test('numeric geometry clamps to interior/type limits, anchors resize and rejects nonfinite input', () => {
  const moved=setBlockGeometry(block,{x:900,y:-20},card);
  assert.equal(moved.x,418);assert.equal(moved.y,0);
  const resized=setBlockGeometry({...block,x:300},{width:900,height:1},card);
  assert.equal(resized.x,300);assert.equal(resized.width,198);assert.equal(resized.height,32);
  assert.deepEqual(setBlockGeometry(block,{x:NaN,width:Infinity},card),block);
  assert.equal(setBlockGeometry(block,{x:23.7},card).x,24);
});

test('optional grid snaps pointer positions/trailing resize edges and respects non-grid frame boundaries', () => {
  const moved=dragBlock(block,9,3,card,{grid:true,align:false}).block;
  assert.equal(moved.x,16);assert.equal(moved.y,24);
  const resized=dragBlock(block,13,11,card,{resize:true,grid:true,align:false}).block;
  assert.equal(resized.x,10);assert.equal((resized.x+resized.width)%8,0);
  assert.equal((resized.y+resized.height)%8,0);
  const edge=dragBlock(block,900,900,card,{grid:true,align:false}).block;
  assert.equal(edge.x+edge.width,498);assert.equal(edge.y+edge.height,316);
  assert.equal(dragBlock(block,9,3,card,{grid:false,align:false}).block.x,19);
});

test('edge/center guides select a nearby valid alignment and can override the grid or be disabled', () => {
  const other={...block,id:'b',x:200,y:100,width:120,height:40};
  const aligned=dragBlock(block,109,0,card,{others:[block,other]});
  assert.equal(aligned.block.x,120);assert.deepEqual(aligned.guides,[{axis:'x',position:200,label:'Block edge'}]);
  assert.equal(dragBlock(block,109,0,card,{others:[other],align:false}).block.x,119);
  const canvasCenter=dragBlock(block,198,0,card,{others:[]});
  assert.equal(canvasCenter.block.x+40,249);
  assert.equal(canvasCenter.guides[0].label,'Card center');
  const withGrid=dragBlock(block,109,0,card,{others:[other],grid:true});
  assert.equal(withGrid.block.x,120);
});

test('resize guides never violate minimum size or relocate the fixed corner', () => {
  const other={...block,id:'b',x:79,y:100};
  const min=dragBlock({...block,x:0},-100,0,card,{resize:true,others:[other]});
  assert.equal(min.block.width,80);assert.equal(min.block.x,0);
  assert(!min.guides.some(g=>g.axis==='x'&&g.position===79));
  const aligned=dragBlock(block,29,0,card,{resize:true,others:[{...other,x:120}]});
  assert.equal(aligned.block.x,10);assert.equal(aligned.block.width,110);
});

test('precise geometry survives Apply/history/storage without saving transient guides or editor options', () => {
  const before=cleanLayout({cards:[{...card,blocks:[block]}]});
  const result=dragBlock(block,109,0,card,{others:[{...block,id:'b',x:200}]});
  const edited={...before,cards:[{...before.cards[0],blocks:[result.block]}]};
  const h=commitHistory(createHistory(before),edited);
  assert.deepEqual(undoHistory(h).present,before);
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...h.present}]})})[0];
  assert.equal(reopened.cards[0].blocks[0].x,120);
  assert.equal(reopened.guides,undefined);assert.equal(reopened.cards[0].blocks[0].grid,undefined);
});
