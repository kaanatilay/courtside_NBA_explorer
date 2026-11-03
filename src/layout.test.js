import test from 'node:test';
import assert from 'node:assert/strict';
import { blankLayout, cleanLayout, connectCards, removeCard, nextCardPosition, readLayoutLibrary, layoutStorageKey } from './layout.js';

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
  assert.deepEqual(readLayoutLibrary(storage),layouts);
  assert.deepEqual(readLayoutLibrary({getItem:()=>'{broken'}),[]);
  assert.deepEqual(readLayoutLibrary({getItem:()=>{throw Error('blocked');}}),[]);
  assert.deepEqual(readLayoutLibrary({getItem:()=>JSON.stringify({version:999,layouts})}),[]);
});

test('new cards avoid existing positions without rearranging the canvas', () => {
  const cards=[{id:'a',metric:'pts',x:20,y:20},{id:'b',metric:'stl',x:320,y:20}];
  const before=structuredClone(cards);
  assert.deepEqual(nextCardPosition(cards),{x:620,y:20});
  assert.deepEqual(cards,before);
});
