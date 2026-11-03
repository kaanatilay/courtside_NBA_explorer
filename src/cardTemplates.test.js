import test from 'node:test';
import assert from 'node:assert/strict';
import { blockMinimum, cleanBlocks, comparisonWidths, formatValue } from './cardDesign.js';
import { cleanTemplate, loadTemplate, readTemplates, templateStorageKey } from './cardTemplates.js';
import { cleanLayout, commitHistory, createHistory, groupBounds, readLayoutLibrary, redoHistory, undoHistory } from './layout.js';

const card={id:'card',metric:'pts',x:20,y:40,width:500,height:400};
const block={id:'b',type:'vertical',metric:'ftPct',scope:'both',label:'both',x:20,y:20,width:180,height:140,showLabel:false,showValue:true,decimals:2};
const template=()=>({id:'t',name:'Shooting',width:500,height:400,blocks:[block]});

test('vertical geometry and formatting persist while invalid options and live values are stripped',()=>{
  assert.deepEqual(blockMinimum('vertical'),{width:160,height:120});
  assert.deepEqual(cleanBlocks([block],card),[block]);
  const invalid=cleanBlocks([{...block,decimals:99,showLabel:'false',value:999}],card)[0];
  assert.equal(invalid.decimals,undefined);assert.equal(invalid.showLabel,undefined);assert.equal(invalid.value,undefined);
  assert.equal(formatValue(77.925,'ftPct',2),'77.92%');
  assert.equal(formatValue(12.34,'pts',0),'12');assert.equal(formatValue(null,'pts',3),'—');
  assert.equal(formatValue(12.34,'pts',99),'12.3');
  assert.deepEqual(comparisonWidths([0,null]),[null,null]);
});

test('browser templates validate names/frame/blocks and never retain provider records or team identities',()=>{
  const clean=cleanTemplate({...template(),name:'  Shooting  ',teams:['BOS','LAL'],rows:[{pts:999}]});
  assert.equal(clean.name,'Shooting');assert.equal(clean.teams,undefined);assert.equal(clean.rows,undefined);
  assert.equal(cleanTemplate({...template(),name:' '}),null);
  assert.equal(cleanTemplate({...template(),width:NaN}),null);
  assert.equal(cleanTemplate({...template(),blocks:null}),null);
  assert.deepEqual(cleanTemplate({...template(),blocks:[]}).blocks,[]);
});

test('template library survives storage roundtrip and tolerates malformed/blocked/stale storage',()=>{
  const templates=[template(),{...template(),id:'copy',name:'Copy'}];
  const storage={getItem:key=>{assert.equal(key,templateStorageKey);return JSON.stringify({version:1,templates});}};
  assert.deepEqual(readTemplates(storage),templates);
  assert.deepEqual(readTemplates({getItem:()=>'{broken'}),[]);
  assert.deepEqual(readTemplates({getItem:()=>{throw Error('blocked');}}),[]);
  assert.deepEqual(readTemplates({getItem:()=>JSON.stringify({version:999,templates})}),[]);
  assert.equal(readTemplates({getItem:()=>JSON.stringify({version:1,templates:[template(),template()]})}).length,1);
});

test('each loaded copy gets independent IDs and editing it never mutates the saved template or another copy',()=>{
  const saved=template(), before=structuredClone(saved);
  const a=loadTemplate(saved,card,()=> 'copy-a'), b=loadTemplate(saved,card,()=> 'copy-b');
  assert.equal(a.blocks[0].id,'copy-a');assert.equal(b.blocks[0].id,'copy-b');
  a.blocks[0].metric='pts';a.blocks[0].decimals=0;
  assert.equal(b.blocks[0].metric,'ftPct');assert.equal(b.blocks[0].decimals,2);
  assert.deepEqual(saved,before);
});

test('a template that does not fit refuses to load rather than clipping or scaling; blank designs still work',()=>{
  const saved={...template(),blocks:[{...block,x:280,y:180}]}, before=structuredClone(saved);
  const result=loadTemplate(saved,{...card,width:260,height:190},()=> 'new',{useTemplateSize:false});
  assert.equal(result.blocks,null);assert.match(result.reason,/does not fit/);assert.deepEqual(saved,before);
  assert.deepEqual(loadTemplate({...template(),blocks:[]},card,()=> 'new').blocks,[]);
});

test('default loads restore the complete source frame including unused space; keep-size mode is explicit',()=>{
  const saved=template(), small={...card,width:260,height:190}, large={...card,width:900,height:700};
  for(const target of [small,large]){
    const result=loadTemplate(saved,target,()=> 'loaded');
    assert.equal(result.width,500);assert.equal(result.height,400);
    assert.equal(result.blocks[0].width,180);assert.equal(result.blocks[0].x,20);
  }
  const kept=loadTemplate(saved,large,()=> 'kept',{useTemplateSize:false});
  assert.equal(kept.width,900);assert.equal(kept.height,700);
  assert.equal(loadTemplate(saved,small,()=> 'bad',{useTemplateSize:false}).blocks,null);
});

test('size and design form one undoable saved transaction while group membership/neighbor positions stay intact',()=>{
  const small={...card,width:260,height:190}, neighbor={...small,id:'neighbor',x:320};
  const base=cleanLayout({cards:[small,neighbor],groups:[{id:'g',cards:['card','neighbor']}]});
  const loaded=loadTemplate(template(),small,()=> 'new');
  const h=commitHistory(createHistory(base),{...base,cards:[{...small,width:loaded.width,height:loaded.height,blocks:loaded.blocks},neighbor]});
  assert.equal(h.past.length,1);assert.deepEqual(undoHistory(h).present,base);
  const restored=redoHistory(undoHistory(h)).present;
  assert.equal(restored.cards[0].width,500);assert.equal(restored.cards[0].height,400);
  assert.deepEqual(restored.groups,base.groups);assert.deepEqual(restored.cards[1],base.cards[1]);
  assert.equal(groupBounds(restored,restored.groups[0]).height,400);
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...restored}]})})[0];
  assert.deepEqual(reopened.cards,restored.cards);assert.deepEqual(reopened.groups,base.groups);
});

test('legacy template frames normalize upward to layout size units without a later save changing the preview',()=>{
  const loaded=loadTemplate({...template(),width:273,height:193,blocks:[]},card,()=> 'new');
  assert.equal(loaded.width,280);assert.equal(loaded.height,200);
  const saved=cleanLayout({cards:[{...card,width:loaded.width,height:loaded.height,blocks:loaded.blocks}]});
  assert.equal(saved.cards[0].width,loaded.width);assert.equal(saved.cards[0].height,loaded.height);
});

test('template-loaded vertical designs/settings pass through layout Apply/Undo and named-layout reopening',()=>{
  const base=cleanLayout({cards:[card]}), loaded=loadTemplate(template(),card,()=> 'loaded');
  const h=commitHistory(createHistory(base),{...base,cards:[{...card,blocks:loaded.blocks}]});
  assert.deepEqual(undoHistory(h).present,base);
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...h.present}]})})[0];
  assert.deepEqual(reopened.cards[0].blocks,loaded.blocks);
  assert.equal(reopened.cards[0].blocks[0].decimals,2);
});

test('styled templates retain validated colors through library/load and independent edits',()=>{
  const styled={...template(),appearance:{background:'#FFFFFF',border:'#123456',text:'red'}};
  const clean=cleanTemplate(styled);assert.deepEqual(clean.appearance,{background:'#ffffff',border:'#123456'});
  const storage={getItem:()=>JSON.stringify({version:1,templates:[styled]})};
  const saved=readTemplates(storage)[0];
  const first=loadTemplate(saved,card,()=> 'first'), second=loadTemplate(saved,card,()=> 'second');
  first.appearance.background='#000000';assert.equal(second.appearance.background,'#ffffff');
  assert.equal(saved.appearance.background,'#ffffff');assert.equal(styled.appearance.background,'#FFFFFF');
});

test('legacy templates retain destination colors while explicit empty appearance restores defaults in either size mode',()=>{
  const target={...card,appearance:{background:'#35243f',border:'#b8a0e4'}};
  for(const useTemplateSize of [true,false]){
    const legacy=loadTemplate(template(),target,()=> 'legacy',{useTemplateSize});
    assert.equal(Object.hasOwn(legacy,'appearance'),false);
    const defaults=loadTemplate({...template(),appearance:{}},target,()=> 'defaults',{useTemplateSize});
    assert.deepEqual(defaults.appearance,{});assert.equal(target.appearance.background,'#35243f');
  }
});

test('template colors join the size/content history transaction and survive layout save/undo/redo',()=>{
  const base=cleanLayout({cards:[card]});
  const loaded=loadTemplate({...template(),appearance:{background:'#f3f0e7',border:'#000000'}},card,()=> 'loaded');
  const h=commitHistory(createHistory(base),{...base,cards:[{...card,width:loaded.width,height:loaded.height,blocks:loaded.blocks,appearance:loaded.appearance}]});
  assert.equal(h.past.length,1);assert.deepEqual(undoHistory(h).present,base);
  const restored=redoHistory(undoHistory(h)).present;
  const saved=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'styled',...restored}]})})[0];
  assert.deepEqual(saved.cards[0].appearance,loaded.appearance);assert.deepEqual(saved.cards[0].blocks,loaded.blocks);
});
