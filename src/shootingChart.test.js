import test from 'node:test';
import assert from 'node:assert/strict';
import { shootingTotals, shootingMetric } from './shootingChart.js';
import { addDesignBlock, cleanBlocks, blockMinimum } from './cardDesign.js';
import { cleanLayout, commitHistory, createHistory, undoHistory, redoHistory } from './layout.js';
import { cleanTemplate, loadTemplate } from './cardTemplates.js';
import { purposeBlocks } from './cardPurpose.js';

const card={id:'c',metric:'pts',x:0,y:0,width:500,height:500};
test('shooting chart partitions totals rather than double counting makes and attempts',()=>{
  const data=shootingTotals([{ftm:1,fta:2},{ftm:9,fta:10},{ftm:0,fta:0}],'ftPct');
  assert.deepEqual(data,{available:true,made:10,missed:2,attempted:12,percentage:10/12*100,games:3});
  assert.equal(data.made+data.missed,data.attempted);
  assert.equal(shootingTotals([{tpm:3,tpa:4}],'tpPct').percentage,75);
});
test('zero makes and perfect shooting are valid; no attempts and incomplete samples are unavailable',()=>{
  assert.equal(shootingTotals([{ftm:0,fta:5}],'ftPct').percentage,0);
  assert.equal(shootingTotals([{ftm:5,fta:5}],'ftPct').percentage,100);
  assert.match(shootingTotals([{ftm:0,fta:0}],'ftPct').reason,/No shooting attempts/);
  assert.match(shootingTotals([],'ftPct').reason,/No games/);
  for(const row of [{ftm:null,fta:4},{ftm:1},{ftm:5,fta:4},{ftm:-1,fta:4},{ftm:1.5,fta:4},{ftm:NaN,fta:4}])
    assert.equal(shootingTotals([{ftm:1,fta:2},row],'ftPct').available,false);
  assert.equal(shootingTotals([{ftm:1,fta:2}],'pts').available,false);
});
test('donut bindings accept only supported shooting choices and require a usable frame',()=>{
  assert.equal(shootingMetric('tpa'),'tpPct');assert.equal(shootingMetric('pts'),null);
  assert.equal(addDesignBlock([],{...card,width:260,height:190},'donut','d'),null);
  const blocks=addDesignBlock([],card,'donut','d');assert.equal(blocks[0].metric,'ftPct');
  assert.deepEqual(blockMinimum('donut'),{width:240,height:180});
  assert.equal(cleanBlocks([{...blocks[0],metric:'pts'}],card).length,0);
  assert.equal(cleanBlocks(blocks,card)[0].type,'donut');
});
test('donut templates, purpose, history and saved layouts retain design without freezing live totals',()=>{
  const blocks=purposeBlocks(addDesignBlock([],card,'donut','d'),{purpose:'related',teamSlot:'b'});
  const template=cleanTemplate({...card,id:'t',name:'Shooting',purpose:'related',teamSlot:'b',blocks});
  const loaded=loadTemplate(template,card,()=> 'copy');assert.equal(loaded.blocks[0].scope,'b');
  const base=cleanLayout({cards:[card]}),next=cleanLayout({cards:[{...card,...loaded}]});
  const history=commitHistory(createHistory(base),next);
  assert.deepEqual(undoHistory(history).present,base);
  assert.deepEqual(redoHistory(undoHistory(history)).present,next);
  assert.deepEqual(cleanLayout(JSON.parse(JSON.stringify(next))),next);
  assert.equal(shootingTotals([{ftm:2,fta:3}],next.cards[0].blocks[0].metric).made,2);
  assert.equal(shootingTotals([{ftm:4,fta:6}],next.cards[0].blocks[0].metric).made,4);
  assert.equal(next.cards[0].blocks[0].made,undefined);
});
