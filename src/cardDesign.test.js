import test from 'node:test';
import assert from 'node:assert/strict';
import { addDesignBlock, blockValues, cleanBlocks, comparisonWidths, designArea, fitBlock, initialBlocks } from './cardDesign.js';
import { applyMagnet, arrangeLayout, cleanLayout, commitHistory, createHistory, magneticPreview, moveCards, readLayoutLibrary, redoHistory, resizeDimensions, undoHistory } from './layout.js';

const card = () => ({ id:'c', metric:'pts', x:20, y:40, width:500, height:400 });
const block = (patch={}) => ({ id:'n', type:'value', metric:'pts', scope:'both', label:'both', x:10, y:10, width:180, height:80, ...patch });

test('legacy, empty and customized designs stay distinct; corrupt bindings and values are not stored', () => {
  const legacy=cleanLayout({cards:[card()]});assert.equal(legacy.cards[0].blocks,undefined);
  assert.equal(initialBlocks(legacy.cards[0]).length,1);
  const custom=cleanBlocks([block({value:999}), block(), block({id:'invalid',metric:'unknown'}), block({id:'bad',x:NaN})],card());
  assert.equal(custom.length,1);assert.equal(custom[0].value,undefined);
  assert.deepEqual(cleanLayout({cards:[{...card(),blocks:[]}]}).cards[0].blocks,[]);
  assert.equal(cleanBlocks('bad',card()),null);
});

test('inner geometry fits its frame and free-space capacity grows with the outer card', () => {
  const fitted=fitBlock(block({x:999,y:-20,width:900,height:1}),card()), area=designArea(card());
  assert.equal(fitted.x+fitted.width,area.width);assert.equal(fitted.y,0);assert.equal(fitted.height,64);
  let blocks=[];
  for(const [i,type] of ['label','value','bar'].entries()) { blocks=addDesignBlock(blocks,card(),type,`b${i}`);assert(blocks); }
  assert.equal(blocks.length,3);assert.deepEqual(new Set(blocks.map(b=>b.type)),new Set(['label','value','bar']));
  const small={...card(),width:260,height:190};
  assert.equal(addDesignBlock(initialBlocks(small),small,'bar','full'),null);
  assert(addDesignBlock(initialBlocks(small),small,'label','caption'));
  assert.equal(addDesignBlock([],card(),'unknown','bad'),null);
});

test('bindings track team slots and weighted shooting samples, preserving missing and zero', () => {
  const rows=[[{pts:100,ftm:1,fta:2},{pts:120,ftm:9,fta:10}],[{pts:90,ftm:0,fta:4}]];
  assert.deepEqual(blockValues(block({scope:'a'}),rows),[{slot:0,value:110,games:2}]);
  assert.equal(blockValues(block({metric:'ftPct',scope:'a'}),rows)[0].value,10/12*100);
  assert.equal(blockValues(block({metric:'ftPct',scope:'b'}),rows)[0].value,0);
  assert.equal(blockValues(block({metric:'stl'}),rows)[0].value,null);
  assert.deepEqual(comparisonWidths([110,55]),[100,50]);
  assert.deepEqual(comparisonWidths([0,0]),[0,0]);
  assert.deepEqual(comparisonWidths([110,null]),[null,null]);
  assert.deepEqual(comparisonWidths([-1,10]),[null,null]);
});

test('applied designs round trip through history and named storage without freezing data', () => {
  const base=cleanLayout({cards:[card()]});let h=createHistory(base);
  const working={...base,cards:[{...card(),blocks:[block(),block({id:'bar',type:'bar',metric:'ftPct',y:120})]}]};
  // A modal preview does not mutate history; one Apply commits all edits.
  assert.equal(h.past.length,0);h=commitHistory(h,working);assert.equal(h.past.length,1);
  assert.equal(undoHistory(h).present.cards[0].blocks,undefined);
  h=redoHistory(undoHistory(h));assert.equal(h.present.cards[0].blocks.length,2);
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...h.present}]})})[0];
  assert.deepEqual(reopened.cards,h.present.cards);
  assert.equal(blockValues(reopened.cards[0].blocks[0],[[{pts:200}],[]])[0].value,200);
});

test('outer resize and magnetic matching preserve inner content; groups and arrangement keep designs', () => {
  const designed={...card(),blocks:[block({x:280,y:180,width:180,height:100})]};
  const resized=resizeDimensions(designed,{width:260,height:190});
  assert(resized.width>=462);assert(resized.height>=364);
  const layout=cleanLayout({cards:[{...designed,x:300,y:100},{id:'target',metric:'ast',x:20,y:40,width:400,height:190}]});
  assert.equal(magneticPreview(layout,'c'),null); // Both matching dimensions would clip content.
  const compatible=cleanLayout({...layout,cards:[layout.cards[0],{...layout.cards[1],width:500}]});
  const preview=magneticPreview(compatible,'c');assert(preview);
  assert(preview.card.height>=364); // Side placement matching 190px must be rejected.
  const grouped=applyMagnet(compatible,preview,'g');
  const moved=moveCards(grouped,grouped.groups[0].cards,80,60);
  const arranged=arrangeLayout(moved);
  assert.deepEqual(arranged.cards[0].blocks,layout.cards[0].blocks);
  assert.deepEqual(arranged.groups,grouped.groups);
});
