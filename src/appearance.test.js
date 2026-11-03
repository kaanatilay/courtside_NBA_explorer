import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundPresets, borderPresets, cardColorStyles, cleanCardAppearance, cleanColor, contrastRatio, readablePalette, workspaceColorStyles, workspacePresets } from './appearance.js';
import { cleanLayout, commitHistory, createHistory, readLayoutLibrary, redoHistory, undoHistory } from './layout.js';

const card={id:'a',metric:'pts',x:20,y:40,width:400,height:270,blocks:[{id:'n',type:'value',metric:'ftPct',scope:'both',label:'both',x:10,y:10,width:160,height:64,decimals:2}]};
const base=()=>cleanLayout({name:'Comparison',cards:[card,{...card,id:'b',x:500}],groups:[{id:'g',cards:['a','b']}],links:[{from:'a',to:'b'}]});

test('only opaque hex colors become style overrides; malformed or arbitrary CSS is discarded',()=>{
  assert.equal(cleanColor('#ABC123'),'#abc123');
  for(const bad of ['red','#abc','#ffffff00','url(secret)','var(--color)',null,123])assert.equal(cleanColor(bad),null);
  assert.deepEqual(cleanCardAppearance({background:'#202C3E',border:'red',color:'secret'}),{background:'#202c3e'});
  assert.equal(cleanCardAppearance({background:'bad'}),null);
  const styles=cardColorStyles({background:'#123442',border:'#70b8eb',fontSize:'99px'});
  assert.equal(styles['--card-background'],'#123442');assert.equal(styles['--card-border'],'#70b8eb');
  assert.equal(styles.fontSize,undefined);assert(Object.values(styles).every(value=>cleanColor(value)));
});

test('contrast uses linear sRGB luminance with known endpoints and rejects invalid colors',()=>{
  assert.equal(contrastRatio('#000000','#ffffff'),21);
  assert.equal(contrastRatio('#123456','#123456'),1);
  assert.equal(contrastRatio('red','#000000'),null);
  assert.equal(readablePalette('#ffffff').text,'#000000');
  assert.equal(readablePalette('#000000').text,'#ffffff');
});

test('automatic main and secondary text meet the design contrast target across light, dark and mid-tone backgrounds',()=>{
  for(const r of [0,51,102,153,204,255])for(const g of [0,51,102,153,204,255])for(const b of [0,51,102,153,204,255]){
    const color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
    const palette=readablePalette(color);
    assert(contrastRatio(color,palette.text)>=4.5);
    assert(contrastRatio(color,palette.muted)>=4.5);
    assert(contrastRatio(color,palette.bar)>=3);
  }
});

test('canvas adaptation is separate from card styles and old palettes remain unmodified',()=>{
  const canvas=workspaceColorStyles('#ffffff');assert.equal(canvas['--workspace-ink'],'#000000');
  assert.equal(canvas['--card-text'],undefined);assert.deepEqual(workspaceColorStyles(undefined),{});
  assert.equal(cardColorStyles({background:'#ffffff'})['--card-text'],'#000000');
  assert.equal(cardColorStyles({border:'#abcdef'})['--card-text'],undefined);
});

test('saved appearance contains only explicit colors; derived readable palettes are recalculated after reopening',()=>{
  const layout=cleanLayout({...base(),cards:base().cards.map(c=>({...c,appearance:{background:'#ffffff',border:'#000000',text:'#123456'}}))});
  assert.deepEqual(layout.cards[0].appearance,{background:'#ffffff',border:'#000000'});
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'theme',...layout}]})})[0];
  assert.equal(cardColorStyles(reopened.cards[0].appearance)['--card-text'],'#000000');
  assert.deepEqual(undoHistory(commitHistory(createHistory(base()),layout)).present,base());
});

test('legacy layouts keep their shape and invalid saved colors do not hide otherwise valid cards',()=>{
  const old=base();assert.equal(old.background,undefined);assert.equal(old.cards[0].appearance,undefined);
  const clean=cleanLayout({...old,background:'bad',cards:old.cards.map(c=>({...c,appearance:{background:'bad',border:'invalid'}}))});
  assert.deepEqual(clean,old);
});

test('card and workspace color changes are undoable, independent and survive named-layout reopening',()=>{
  const old=base();
  const colored={...old,background:'#101823',cards:old.cards.map(c=>c.id==='a'?{...c,appearance:{background:'#35243f',border:'#b8a0e4'}}:c)};
  let h=commitHistory(createHistory(old),colored);assert.equal(h.past.length,1);
  assert.deepEqual(undoHistory(h).present,old);h=redoHistory(undoHistory(h));
  const reopened=readLayoutLibrary({getItem:()=>JSON.stringify({version:1,layouts:[{id:'saved',...h.present}]})})[0];
  assert.equal(reopened.background,'#101823');assert.deepEqual(reopened.cards[0].appearance,colored.cards[0].appearance);
  assert.equal(reopened.cards[1].appearance,undefined);assert.deepEqual(reopened.groups,old.groups);
  assert.deepEqual(reopened.cards[0].blocks,old.cards[0].blocks);
});

test('resets remove only overrides and undo restores them without changing size, data bindings or lines',()=>{
  const old=base(), colored=cleanLayout({...old,background:'#15151f',cards:old.cards.map(c=>({...c,appearance:{background:'#222629',border:'#d9b971'}}))});
  const reset=cleanLayout({...colored,background:undefined,cards:colored.cards.map(c=>({...c,appearance:undefined}))});
  assert.deepEqual(reset,old);
  const h=commitHistory(createHistory(colored),reset);assert.deepEqual(undoHistory(h).present,colored);
});

test('all provided presets validate and style conversion never adds default overrides to old cards',()=>{
  for(const [,color] of [...backgroundPresets,...borderPresets,...workspacePresets])assert.equal(cleanColor(color),color);
  assert.deepEqual(cardColorStyles(undefined),{});assert.deepEqual(cardColorStyles({unknown:'#abcdef'}),{});
});
