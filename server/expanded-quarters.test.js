import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeGame } from './normalize.js';
import { deriveTeamQuarters } from './quarters.js';
import { average, rowsFor } from '../src/stats.js';

const recent = JSON.parse(await readFile(new URL('./fixtures/espn-401909285.json', import.meta.url), 'utf8'));
const overtime = JSON.parse(await readFile(new URL('./fixtures/espn-401703371.json', import.meta.url), 'utf8'));

test('reviewed GSW Q1 and Detroit overtime examples expose new counting metrics', () => {
  const gs = normalizeGame(recent).sides.GSW;
  assert.deepEqual(Object.fromEntries(['stl','ftm','fta','tpm','tpa','leadChanges'].map(k=>[k,gs.periods[0][k]])),
    { stl:5, ftm:1, fta:2, tpm:4, tpa:10, leadChanges:1 });
  // These events were inspected directly: GSW steals appear on LAL turnovers;
  // the made running three-pointer at suffix 49 has no 'three' in its text.
  for(const suffix of [47,56,91,97,177]) assert(recent.plays.some(p=>p.id===`401909285${suffix}`&&/steals/.test(p.text)));
  const det = normalizeGame(overtime).sides.DET.periods[4];
  assert.deepEqual(Object.fromEntries(['stl','ftm','fta','tpm','tpa'].map(k=>[k,det[k]])), {stl:0,ftm:5,fta:8,tpm:1,tpa:1});
  assert.equal(det.leadChanges,null); // Historical full-game comparator absent.
  const game=normalizeGame(recent);
  assert.equal(average(rowsFor([game],'GSW','1'),'tpPct'),40);
  assert.equal(average(rowsFor([game],'GSW','1'),'ftPct'),50);
});

test('ambiguous steals, shooting attempts and source mismatches withhold affected metrics', () => {
  const steal=structuredClone(recent);
  steal.plays.find(p=>p.id==='40190928547').participants.pop();
  const badSteal=normalizeGame(steal);
  assert.equal(badSteal.sides.GSW.periods[0].stl,null);
  assert.equal(badSteal.sides.GSW.periods[0].ast,5);
  const shot=structuredClone(recent);
  const missed=shot.plays.find(p=>p.period.number===1&&p.type.text.includes('Free Throw')&&!p.scoringPlay);
  shot.plays=shot.plays.filter(p=>p.id!==missed.id);
  const game=normalizeGame(shot), id=missed.team.id==='9'?'GSW':'LAL';
  assert.equal(game.sides[id].periods[0].fta,null);
  assert.equal(average(rowsFor([game],id,'1'),'ftPct'),null);
  assert.equal(normalizeGame(recent).sides.LAL.periods[0].tpa,null);
  assert.match(normalizeGame(recent).sides.LAL.quarterValidation.unavailable.tpa,/full-game/);
});

// Controlled score path provides an independent benchmark for ties and the
// leader carried into the next period; free throws and threes share this path.
function leadFixture() {
  const sequence=[[1,'H',2],[1,'A',2],[2,'A',1],[2,'H',1],[2,'H',1],[3,'H',3],[4,'A',3],[4,'A',2]];
  const stats={H:{pts:0,ast:0,oreb:0,dreb:0,blk:0,stl:0,ftm:0,fta:0,tpm:0,tpa:0,leadChanges:3},A:{pts:0,ast:0,oreb:0,dreb:0,blk:0,stl:0,ftm:0,fta:0,tpm:0,tpa:0,leadChanges:3}};
  const scores={H:0,A:0}, points={H:[0,0,0,0],A:[0,0,0,0]}, plays=[];
  for(let period=1;period<=4;period++){
    let time=11;
    for(const [p,id,value]of sequence.filter(x=>x[0]===period)){
      scores[id]+=value;stats[id].pts+=value;points[id][p-1]+=value;
      if(value===1){stats[id].ftm++;stats[id].fta++;}
      if(value===3){stats[id].tpm++;stats[id].tpa++;}
      plays.push({id:String(plays.length+1),sequenceNumber:String(plays.length+1),period:{number:p},clock:{displayValue:`${time--}:00`},type:{text:value===1?'Free Throw - Technical':'Jump Shot'},text:value===1?'Player makes free throw technical':`Player makes ${value===3?'three point jumper':'two point jumper'}`,team:{id},participants:[{athlete:{id:id+'1'}}],scoringPlay:true,shootingPlay:true,scoreValue:value,homeScore:scores.H,awayScore:scores.A});
    }
    plays.push({id:String(plays.length+1),sequenceNumber:String(plays.length+1),period:{number:period},clock:{displayValue:'0:00'},type:{text:'End Period'}});
  }
  const sides=Object.fromEntries(['H','A'].map(id=>[id,{homeAway:id==='H'?'home':'away',stats:stats[id],periods:points[id].map(pts=>({pts})),players:[{id:id+'1'}]}]));
  return {payload:{plays},sides,teamMap:['H','A'].map(id=>({id,providerId:id}))};
}
test('ties do not count, first lead is not a change, and leader carries across quarters', () => {
  const f=leadFixture();
  const result=deriveTeamQuarters(f.payload,f.sides,f.teamMap);
  assert.deepEqual(result.H.periods.map(p=>p.leadChanges),[0,2,0,1]);
  assert.equal(result.H.quarterValidation.status,'checked');
  assert.deepEqual(result.A.periods.map(p=>p.leadChanges),[0,2,0,1]);
  const changed=structuredClone(f);changed.payload.plays.find(p=>p.scoringPlay).homeScore=99;
  const bad=deriveTeamQuarters(changed.payload,changed.sides,changed.teamMap);
  assert.equal(bad.H.periods[0].leadChanges,null);
  assert.equal(bad.H.periods[0].tpm,0);
});

test('structured pointsAttempted resolves a missed three with a nonspecific description', () => {
  const f=leadFixture();
  const end=f.payload.plays.find(p=>p.period.number===1&&p.type.text==='End Period');
  f.payload.plays.push({id:'miss',sequenceNumber:'99',period:{number:1},clock:{displayValue:'1:00'},
    type:{text:'Running Pullup Jump Shot'},text:'Player misses running pullup jump shot',
    team:{id:'H'},participants:[{athlete:{id:'H1'}}],shootingPlay:true,scoringPlay:false,scoreValue:0,pointsAttempted:3});
  f.sides.H.stats.tpa++;
  const r=deriveTeamQuarters(f.payload,f.sides,f.teamMap);
  assert.equal(r.H.periods[0].tpa,1);
  assert.equal(r.H.quarterValidation.status,'checked');
  f.payload.plays.at(-1).pointsAttempted=2;
  assert.equal(deriveTeamQuarters(f.payload,f.sides,f.teamMap).H.periods[0].tpa,null);
});

test('new fields preserve late corrections, identical deduplication and conflicting duplicate rejection', () => {
  const original=normalizeGame(recent),p=structuredClone(recent);
  p.plays.reverse();assert.deepEqual(normalizeGame(p),original);
  p.plays.push(structuredClone(p.plays.find(p=>p.scoringPlay)));
  assert.deepEqual(normalizeGame(p).sides.GSW.periods,original.sides.GSW.periods);
  p.plays.at(-1).homeScore=999;
  assert.equal(normalizeGame(p).sides.GSW.periods[0].stl,null);
});
