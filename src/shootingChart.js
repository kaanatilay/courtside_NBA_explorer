// A shooting chart is a partition of attempts, not a comparison of makes with
// attempts (which would count makes twice). Only these verified field pairs fit.
export const shootingMetrics = [['ftPct','Free throws · makes / misses'],['tpPct','Three-pointers · makes / misses']];
const pairs = {ftPct:['ftm','fta'],tpPct:['tpm','tpa']};
export const shootingMetric = metric => ['ftm','fta','ftPct'].includes(metric) ? 'ftPct'
  : ['tpm','tpa','tpPct'].includes(metric) ? 'tpPct' : null;

// Require every game/period in the selected sample. Missing observations are
// never dropped; zero-attempt games contribute zero when other games have shots.
export function shootingTotals(rows,metric) {
  const pair=pairs[metric];
  if(!pair)return {available:false,reason:'Choose free throws or three-pointers.'};
  if(!rows?.length)return {available:false,reason:'No games in this sample.'};
  if(rows.some(row=>pair.some(key=>!Number.isSafeInteger(row[key])||row[key]<0)||row[pair[0]]>row[pair[1]]))
    return {available:false,reason:'Missing or invalid shooting data in this sample.'};
  const made=rows.reduce((sum,row)=>sum+row[pair[0]],0),attempted=rows.reduce((sum,row)=>sum+row[pair[1]],0);
  if(!Number.isSafeInteger(made)||!Number.isSafeInteger(attempted))return {available:false,reason:'Shooting totals exceed the supported range.'};
  if(!attempted)return {available:false,reason:'No shooting attempts in this sample.'};
  return {available:true,made,missed:attempted-made,attempted,percentage:made/attempted*100,games:rows.length};
}
