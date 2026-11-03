import React from 'react';
import { cleanColor, contrastRatio, defaultColors, readablePalette } from './appearance.js';

// Ratios describe the actual foreground/background pair, not a blanket
// accessibility certification. Border guidance never overrides the user's pick.
export default function ContrastFeedback({ background, border, workspace=false, onReadableBorder }) {
  const color=cleanColor(background)||(workspace?defaultColors.workspaceBackground:defaultColors.cardBackground);
  const palette=readablePalette(color), ratio=contrastRatio(color,border||defaultColors.cardBorder);
  return <div className="contrast-feedback">
    <p>{cleanColor(background)?`Automatic ${palette.text==='#000000'?'dark':'light'} text${workspace?'/canvas lines':''} · text contrast ${palette.ratio.toFixed(2)}:1.`:'Original palette retained. Setting a background enables automatic text colors.'}</p>
    {!workspace&&<p>Border contrast {ratio.toFixed(2)}:1. {ratio<3?'The frame may blend into this background; a stronger border can help.':'The frame is distinct from the card background.'} {onReadableBorder&&<button className="close-button" onClick={()=>onReadableBorder(palette.text)}>Use contrasting border</button>}</p>}
    <p>Text target: at least 4.5:1; border guidance: 3:1. Check your actual layout too—overlaps, hidden labels and very small frames still affect readability.</p>
  </div>;
}
