import { cleanPurpose, purposeBlocks } from './cardPurpose.js';
import { blockCapacity, cleanBlocks, contentMinimum, designFits } from './cardDesign.js';
import { cleanCardAppearance } from './appearance.js';

export const templateStorageKey='courtside:card-templates:v1';

// Templates contain a validated design in its original frame, never current
// team identities, sample filters or provider values. Browser storage is local.
export function cleanTemplate(value) {
  if(typeof value?.id!=='string'||!value.id||typeof value.name!=='string'||!value.name.trim()
    ||!Number.isFinite(value.width)||!Number.isFinite(value.height)||!Array.isArray(value.blocks))return null;
  const card={width:Math.max(260,Math.min(1200,Math.ceil(value.width/10)*10)),height:Math.max(190,Math.min(1000,Math.ceil(value.height/10)*10))};
  // Absent appearance marks a legacy template and retains destination colors.
  // Explicit {} is a new template intentionally using the original palette.
  return {id:value.id,name:value.name.trim().slice(0,80),...card,...cleanPurpose(value),blocks:purposeBlocks(cleanBlocks(value.blocks,card),value),
    ...(Object.hasOwn(value,'appearance')?{appearance:cleanCardAppearance(value.appearance)||{}}:{})};
}
export function readTemplates(storage) {
  try {
    const data=JSON.parse(storage.getItem(templateStorageKey));if(data?.version!==1||!Array.isArray(data.templates))return [];
    const seen=new Set();return data.templates.map(cleanTemplate).filter(t=>{
      if(!t||seen.has(t.id))return false;seen.add(t.id);return true;
    }).slice(0,50);
  } catch {return [];}
}

// Default loads restore the complete saved frame. Keep-size loads validate the
// current frame instead. Neither mode scales/drops contents; fresh IDs keep
// each loaded copy independent. Dimensions commit only when the modal applies.
export function loadTemplate(template, card, makeId, {useTemplateSize=true}={}) {
  const clean=cleanTemplate(template);
  if(!clean)return {blocks:null,reason:'This template is invalid.'};
  const frame=useTemplateSize?{width:clean.width,height:clean.height}:{width:card.width,height:card.height};
  const target={...card,...frame};
  const minimum=contentMinimum({...target,blocks:clean.blocks});
  if(!designFits({...target,blocks:clean.blocks})||clean.blocks.length>blockCapacity(target))return {
    blocks:null,reason:`Template does not fit this card. It needs at least ${Math.ceil(minimum.width/10)*10} × ${Math.ceil(minimum.height/10)*10}, with room for ${clean.blocks.length} blocks. Cancel and enlarge the outer card first.`
  };
  return {...frame,...cleanPurpose(clean),blocks:clean.blocks.map(b=>({...b,id:makeId()})),
    ...(Object.hasOwn(clean,'appearance')?{appearance:{...clean.appearance}}:{}),
    reason:`Template loaded as an independent working copy (${frame.width} × ${frame.height}; ${useTemplateSize?'template size':'current size kept'}; ${Object.hasOwn(clean,'appearance')?'template colors restored':'legacy template: current colors kept'}). Apply commits size, design and colors.`};
}
