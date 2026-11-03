// Purpose is presentation metadata. It binds to selection slots, never saved
// team identities or filters. Missing metadata preserves older mixed designs.
export const cardPurposes = { flexible:'Flexible / legacy', single:'Single team', comparison:'Team comparison', related:'Related statistics' };
export function cleanPurpose(value) {
  return value && Object.hasOwn(cardPurposes,value.purpose) && value.purpose!=='flexible'
    ? {purpose:value.purpose,teamSlot:value.teamSlot==='b'?'b':'a'} : {};
}

// Normalize existing and newly added blocks through the same policy. Related
// statistics retain independent metric choices; no new statistics are derived.
export function purposeBlocks(blocks, settings) {
  const {purpose,teamSlot}=cleanPurpose(settings);
  if(!purpose)return blocks;
  const scope=purpose==='comparison'?'both':teamSlot;
  return blocks.map(block=>({...block,scope}));
}
