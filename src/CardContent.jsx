import React from 'react';
import { blockValues, comparisonWidths, formatValue, metricLabel } from './cardDesign.js';
import ShootingDonut from './ShootingDonut.jsx';

// Both the editor preview and applied canvas use this renderer and the same
// current rows. A visual bar is relative to the largest displayed team value;
// it does not turn counts into percentages or make missing data into zero.
export function BlockContent({ block, ids, rows, loading, error }) {
  if(block.type==='donut')return <ShootingDonut block={block} ids={ids} rows={rows} loading={loading} error={error}/>;
  const data = blockValues(block, rows);
  const widths = loading || error ? data.map(() => null) : comparisonWidths(data.map(d => d.value));
  const showLabel=block.showLabel!==false, showValue=block.showValue!==false;
  const chart=block.type==='bar'||block.type==='vertical';
  if (block.type === 'label') return <div className="card-block-label">{
    block.label === 'stat' ? metricLabel(block.metric) : data.map(d => block.label === 'team' ? ids[d.slot] : `${ids[d.slot]} · ${metricLabel(block.metric)}`).join(' / ')
  }</div>;
  return <div className={`card-block-${block.type}`}>
    {data.map((d,i) => <div className="card-block-series" key={d.slot} title={`${ids[d.slot]} · ${metricLabel(block.metric)}: ${loading?'loading':error?'unavailable':formatValue(d.value,block.metric,block.decimals)}`}>
      {showLabel&&<span>{ids[d.slot]} · {metricLabel(block.metric)}</span>}
      {showValue&&<strong>{loading ? '…' : error ? '—' : formatValue(d.value, block.metric,block.decimals)}</strong>}
      {chart ? <>
        <div className="card-block-track" aria-hidden="true">{widths[i] !== null && <i style={block.type==='vertical'?{height:`${widths[i]}%`}:{ width: `${widths[i]}%` }} />}</div>
        {!showValue&&(loading||error||!Number.isFinite(d.value))&&<small>{loading?'Loading…':'Unavailable'}</small>}
      </> : showLabel&&<small>{d.games} games</small>}
    </div>)}
  </div>;
}

export default function CardContent({ blocks, ...data }) {
  return <div className="card-design-content">
    {!blocks.length && <span className="card-design-empty">Empty design · use Edit card</span>}
    {blocks.map(block => <div key={block.id} className="card-design-block" style={{ left: block.x, top: block.y, width: block.width, height: block.height }}>
      <BlockContent block={block} {...data} />
    </div>)}
  </div>;
}
