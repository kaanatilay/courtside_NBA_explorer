import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPurpose, purposeBlocks } from './cardPurpose.js';
import { blockValues } from './cardDesign.js';
import { cleanLayout, createHistory, commitHistory, undoHistory, redoHistory } from './layout.js';
import { cleanTemplate, loadTemplate } from './cardTemplates.js';

const blocks=[{id:'one',type:'value',metric:'ftm',scope:'a',label:'both',x:0,y:0,width:160,height:64},
  {id:'two',type:'value',metric:'ftPct',scope:'both',label:'both',x:0,y:70,width:160,height:64}];
const card={id:'c',metric:'ftm',x:0,y:0,width:400,height:400,blocks};

test('legacy bindings survive; explicit purposes normalize slots without changing metrics or source blocks',()=>{
  assert.deepEqual(cleanPurpose({purpose:'unknown'}),{});
  assert.equal(purposeBlocks(blocks,{}),blocks);
  for(const purpose of ['single','related','comparison']) {
    const result=purposeBlocks(blocks,{purpose,teamSlot:'b'});
    assert.deepEqual(result.map(b=>b.scope),[purpose==='comparison'?'both':'b',purpose==='comparison'?'both':'b']);
    assert.deepEqual(result.map(b=>b.metric),['ftm','ftPct']);
  }
  assert.equal(blocks[0].scope,'a');
  assert.equal(cleanPurpose({purpose:'single',teamSlot:'invalid'}).teamSlot,'a');
});

test('purpose follows live selection rows, weighted percentages, empty and missing quarter samples',()=>{
  const bound=purposeBlocks(blocks,{purpose:'related',teamSlot:'b'});
  const rows=[[{ftm:99,fta:100}],[{ftm:1,fta:2},{ftm:9,fta:10}]];
  assert.equal(blockValues(bound[1],rows)[0].value,10/12*100);
  assert.equal(blockValues(bound[0],[rows[1],rows[0]])[0].value,99);
  assert.equal(blockValues(bound[1],[[],[{ftm:null,fta:null}]])[0].value,null);
  assert.equal(blockValues(bound[0],[[],[]])[0].value,null);
});

test('purpose, team slot and normalized blocks survive layout history and JSON reload',()=>{
  const base=cleanLayout({cards:[card]});
  const applied=cleanLayout({cards:[{...card,purpose:'single',teamSlot:'b'}]});
  const history=commitHistory(createHistory(base),applied);
  assert.deepEqual(undoHistory(history).present,base);
  assert.deepEqual(redoHistory(undoHistory(history)).present,applied);
  assert.deepEqual(cleanLayout(JSON.parse(JSON.stringify(applied))),applied);
  assert.equal(applied.cards[0].blocks[1].scope,'b');
});

test('templates carry purpose independently, while legacy templates keep mixed bindings',()=>{
  const template=cleanTemplate({...card,id:'t',name:'Shooting',purpose:'related',teamSlot:'b'});
  let id=0;
  const loaded=loadTemplate(template,card,()=>String(++id));
  assert.equal(loaded.purpose,'related');assert.equal(loaded.teamSlot,'b');
  loaded.blocks[0].scope='a';assert.equal(template.blocks[0].scope,'b');
  const legacy=loadTemplate({...card,id:'old',name:'Old'},card,()=>String(++id));
  assert.equal(legacy.purpose,undefined);assert.equal(legacy.blocks[1].scope,'both');
});
