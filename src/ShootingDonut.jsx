import React from 'react';
import { shootingTotals } from './shootingChart.js';
import { formatValue } from './cardDesign.js';

// SVG segments encode makes and misses on a true 0–100% whole. Each team has
// its own attempt pool. Text and an accessible summary accompany the colors.
export default function ShootingDonut({block,ids,rows,loading,error}) {
  const slots=block.scope==='a'?[0]:block.scope==='b'?[1]:[0,1];
  const label=block.metric==='ftPct'?'Free throws':'Three-pointers';
  return <div className="card-block-donut">{slots.map(slot=>{
    const data=shootingTotals(rows[slot]||[],block.metric);
    const reason=loading?'Loading…':error?'Shooting data unavailable.':data.reason;
    const available=!loading&&!error&&data.available;
    const summary=available?`${ids[slot]} · ${label}: ${data.made} made, ${data.missed} missed, ${data.attempted} attempts; ${formatValue(data.percentage,block.metric,block.decimals)}. Totals across ${data.games} games.`:`${ids[slot]} · ${label}: ${reason}`;
    return <div className="shooting-donut-series" key={slot} title={summary}>
      {block.showLabel!==false&&<span>{ids[slot]} · {label}</span>}
      {available?<>
        <svg viewBox="0 0 100 100" role="img" aria-label={summary}>
          <circle className="donut-missed" cx="50" cy="50" r="36" fill="none" strokeWidth="14" />
          <circle className="donut-made" cx="50" cy="50" r="36" fill="none" strokeWidth="14" pathLength="100" strokeDasharray={`${data.percentage} ${100-data.percentage}`} transform="rotate(-90 50 50)" />
          {block.showValue!==false&&<text x="50" y="53" textAnchor="middle">{formatValue(data.percentage,block.metric,block.decimals)}</text>}
        </svg>
        <small><i className="donut-key-made"/>Made{block.showValue!==false?` ${data.made}`:''} · <i className="donut-key-missed"/>Missed{block.showValue!==false?` ${data.missed}`:''}</small>
        {block.showValue!==false&&<small>{data.attempted} attempts · {data.games} games · totals</small>}
      </>:<div className="shooting-donut-unavailable" role="status">{reason}</div>}
    </div>;
  })}</div>;
}
