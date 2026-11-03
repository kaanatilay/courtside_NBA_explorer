import test from 'node:test';
import assert from 'node:assert/strict';
import { blankLayout, cleanLayout, connectCards, removeCard, nextCardPosition, readLayoutLibrary, layoutStorageKey, dimensions, arrangeCards, createHistory, commitHistory, undoHistory, redoHistory, magneticPreview, applyMagnet, groupBounds, moveCards, ungroup, arrangeLayout } from './layout.js';

test('layouts preserve independent repeated-stat cards and sanitize bad browser data', () => {
  const clean = cleanLayout({ name: 'Shooting', cards: [
    {id:'a',metric:'pts',x:31,y:-10,value:999}, {id:'b',metric:'pts',x:600,y:20},
    {id:'b',metric:'stl',x:0,y:0}, {id:'c',metric:'unknown',x:0,y:0}, {id:'d',metric:'ast',x:NaN,y:0}
  ], links: [{from:'a',to:'b'},{from:'b',to:'a'},{from:'a',to:'missing'},{from:'a',to:'a'}] });
  assert.equal(clean.cards.length,2); assert.equal(clean.cards[0].x,40); assert.equal(clean.cards[0].y,0);
  assert.equal(clean.cards[0].value,undefined); assert.equal(clean.links.length,1);
  const removed=removeCard(clean,'a'); assert.equal(removed.cards.length,1); assert.deepEqual(removed.links,[]);
  assert.deepEqual(connectCards(clean,'a','b').links,clean.links);
});

test('named layouts survive storage round trip without storing stat values', () => {
  const layouts=[{id:'first',...blankLayout(),name:'First'},{id:'second',name:'Second',cards:[{id:'x',metric:'ftPct',x:20,y:20}],links:[]}];
  const storage={getItem:key=>{assert.equal(key,layoutStorageKey);return JSON.stringify({version:1,layouts});}};
  assert.deepEqual(readLayoutLibrary(storage),layouts.map(l=>({id:l.id,...cleanLayout(l)})));
  assert.deepEqual(readLayoutLibrary({getItem:()=>'{broken'}),[]);
  assert.deepEqual(readLayoutLibrary({getItem:()=>{throw Error('blocked');}}),[]);
  assert.deepEqual(readLayoutLibrary({getItem:()=>JSON.stringify({version:999,layouts})}),[]);
});

test('legacy cards get default dimensions and saved resize values survive reopen', () => {
  const legacy=cleanLayout({cards:[{id:'a',metric:'pts',x:20,y:20}]});
  assert.equal(legacy.cards[0].width,260); assert.equal(legacy.cards[0].height,190);
  const resized=cleanLayout({...legacy,cards:legacy.cards.map(c=>({...c,width:480,height:330}))});
  const storage={getItem:()=>JSON.stringify({version:1,layouts:[{id:'named',...resized}]})};
  assert.equal(readLayoutLibrary(storage)[0].cards[0].width,480);
  assert.equal(readLayoutLibrary(storage)[0].cards[0].height,330);
  assert.deepEqual(dimensions({width:0,height:-20}),{width:260,height:190});
  assert.deepEqual(dimensions({width:99999,height:99999}),{width:1200,height:1000});
});

test('a whole drag/resize is one undo entry and new edits clear redo', () => {
  let h=createHistory({cards:[{id:'a',metric:'pts',x:20,y:20}]});
  const before=h.present;
  // Simulate multiple gesture previews; only pointer release commits history.
  for(const width of [280,300,320])h={...h,present:{...h.present,cards:h.present.cards.map(c=>({...c,width}))}};
  h=commitHistory(h,h.present,before);
  assert.equal(h.past.length,1); assert.equal(h.present.cards[0].width,320);
  h=undoHistory(h);assert.equal(h.present.cards[0].width,260);
  h=redoHistory(h);assert.equal(h.present.cards[0].width,320);
  h=undoHistory(h);h=commitHistory(h,{...h.present,name:'New design'});
  assert.equal(h.future.length,0);
  const count=h.past.length;h=commitHistory(h,h.present);assert.equal(h.past.length,count);
  assert.equal(createHistory(h.present).past.length,0);
});

test('undo restores removed cards and their lines, then redo removes them again', () => {
  let h=createHistory({cards:[{id:'a',metric:'pts',x:20,y:20},{id:'b',metric:'stl',x:320,y:20}],links:[{from:'a',to:'b'}]});
  h=commitHistory(h,removeCard(h.present,'a'));assert.equal(h.present.links.length,0);
  h=undoHistory(h);assert.equal(h.present.cards.length,2);assert.equal(h.present.links.length,1);
  h=redoHistory(h);assert.equal(h.present.cards.length,1);assert.equal(h.present.links.length,0);
});

test('placing and arranging respects resized card rectangles', () => {
  const cards=[{id:'a',metric:'pts',x:20,y:20,width:700,height:450},{id:'b',metric:'stl',x:20,y:20,width:400,height:250}];
  const position=nextCardPosition(cards);assert(position.y>=490||position.x>=740);
  const arranged=arrangeCards(cards);
  assert(arranged[1].y>=arranged[0].y+arranged[0].height+20);
});

test('new cards avoid existing positions without rearranging the canvas', () => {
  const cards=[{id:'a',metric:'pts',x:20,y:20},{id:'b',metric:'stl',x:320,y:20}];
  const before=structuredClone(cards);
  assert.deepEqual(nextCardPosition(cards),{x:620,y:20});
  assert.deepEqual(cards,before);
});

const magneticLayout = () => cleanLayout({ cards: [
  {id:'a',metric:'pts',x:20,y:60,width:400,height:270},
  {id:'b',metric:'stl',x:320,y:80,width:260,height:190},
] });

test('overlap previews a free aligned slot and matches the touching dimension', () => {
  const layout=magneticLayout(), preview=magneticPreview(layout,'b');
  assert.equal(preview.side,'right'); assert.equal(preview.card.x,440);
  assert.equal(preview.card.y,60); assert.equal(preview.card.height,270);
  assert.equal(preview.card.width,260); assert.equal(layout.cards[1].height,190);
  const stacked=cleanLayout({...layout,cards:[layout.cards[0],{...layout.cards[1],x:40,y:240}]});
  const below=magneticPreview(stacked,'b');assert.equal(below.side,'below');assert.equal(below.card.width,400);
  assert.equal(magneticPreview(cleanLayout({...layout,cards:[layout.cards[0],{...layout.cards[1],x:800}]}),'b'),null);
});

test('magnetic grouping, movement and ungrouping each round trip through history/storage', () => {
  const original=magneticLayout();let h=createHistory(original);
  h=commitHistory(h,applyMagnet(original,magneticPreview(original,'b'),'g'));
  assert.deepEqual(h.present.groups,[{id:'g',cards:['a','b']}]);
  assert.equal(undoHistory(h).present.cards[1].height,190);
  assert.equal(undoHistory(h).present.groups.length,0);
  h=redoHistory(undoHistory(h));
  const before=h.present, moved=moveCards(before,['a','b'],-200,-200);
  assert.equal(moved.cards[0].x,0);assert.equal(moved.cards[1].x-moved.cards[0].x,420);
  assert.equal(moved.cards[0].y,0);assert.equal(moved.cards[1].y,0);
  h=commitHistory(h,moved);assert.deepEqual(undoHistory(h).present,before);
  const saved=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...moved}]})});
  assert.deepEqual(saved[0].groups,moved.groups);
  h=commitHistory(h,ungroup(h.present,'g'));assert.equal(h.present.groups.length,0);
  assert.deepEqual(undoHistory(h).present.groups,moved.groups);
  assert.deepEqual(h.present.cards,moved.cards);
});

test('group sanitation, extension and removal preserve valid independent membership', () => {
  let layout=magneticLayout();layout=applyMagnet(layout,magneticPreview(layout,'b'),'g');
  layout=cleanLayout({...layout,cards:[...layout.cards,{id:'c',metric:'ast',x:640,y:60}],groups:[...layout.groups,{id:'bad',cards:['a','missing','c','c']} ]});
  assert.equal(layout.groups.length,1);
  layout=applyMagnet(layout,magneticPreview(layout,'c'),'unused');
  assert.deepEqual(layout.groups,[{id:'g',cards:['a','b','c']}]);
  assert.equal(magneticPreview(layout,'a'),null);
  assert.equal(removeCard(removeCard(layout,'a'),'b').groups.length,0);
  assert.deepEqual(cleanLayout({cards:layout.cards}).groups,[]);
});

test('blocked snap candidates never overlap cards and arrangement preserves group offsets', () => {
  const base=magneticLayout();const layout=cleanLayout({...base,cards:[...base.cards,{id:'block',metric:'ast',x:440,y:60}]});
  const preview=magneticPreview(layout,'b');
  assert(preview);
  assert(layout.cards.filter(c=>c.id!=='b').every(c=>preview.card.x>=c.x+c.width||preview.card.x+preview.card.width<=c.x||preview.card.y>=c.y+c.height||preview.card.y+preview.card.height<=c.y));
  const grouped=applyMagnet(base,magneticPreview(base,'b'),'g');
  const arranged=arrangeLayout(cleanLayout({...grouped,cards:[...grouped.cards,{id:'c',metric:'ast',x:20,y:60}]}));
  assert.equal(arranged.cards[1].x-arranged.cards[0].x,420);
  assert.deepEqual(arranged.groups,grouped.groups);
  const box=groupBounds(arranged,arranged.groups[0]);assert.equal(box.width,680);
  assert(arranged.cards[2].y>=box.y+box.height);
});
