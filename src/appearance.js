// Persist only opaque hex colors, not arbitrary CSS. Omitting overrides keeps
// legacy layouts looking exactly as before and makes resets reversible edits.
export const defaultColors={cardBackground:'#1b3025',cardBorder:'#5e7a66',workspaceBackground:'#101e19'};
export const backgroundPresets=[['Forest','#1b3025'],['Slate','#202c3e'],['Ocean','#123442'],['Plum','#35243f'],['Charcoal','#222629'],['Paper','#f3f0e7']];
export const borderPresets=[['Forest','#5e7a66'],['Sky','#70b8eb'],['Gold','#d9b971'],['Lavender','#b8a0e4'],['Coral','#e89385']];
export const workspacePresets=[['Forest','#101e19'],['Night','#101823'],['Ink','#15151f'],['Warm','#211b19'],['Paper','#ecebe5']];
export const cleanColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
export function cleanCardAppearance(value) {
  const background=cleanColor(value?.background), border=cleanColor(value?.border);
  return background||border?{...(background?{background}:{}),...(border?{border}:{})}:null;
}

// Compute contrast from linearized sRGB luminance. Choosing the higher-contrast
// black/white foreground keeps text legible across arbitrary opaque backgrounds.
// Secondary text is softened only if it still reaches our 4.5:1 design target.
function luminance(color) {
  const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)
    .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
export function contrastRatio(a,b) {
  if(!cleanColor(a)||!cleanColor(b))return null;
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function blend(background,foreground,amount) {
  return '#'+[1,3,5].map(i=>Math.round(parseInt(background.slice(i,i+2),16)*(1-amount)+parseInt(foreground.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
}
export function readablePalette(value) {
  const background=cleanColor(value)||defaultColors.cardBackground;
  const text=contrastRatio(background,'#000000')>=contrastRatio(background,'#ffffff')?'#000000':'#ffffff';
  const soft=blend(background,text,.75), muted=contrastRatio(background,soft)>=4.5?soft:text;
  return {text,muted,track:blend(background,text,.14),separator:blend(background,text,.35),
    bar:contrastRatio(background,'#c4e29c')>=3?'#c4e29c':text,ratio:contrastRatio(background,text)};
}
export function cardColorStyles(value) {
  const appearance=cleanCardAppearance(value);
  const palette=appearance?.background?readablePalette(appearance.background):null;
  return {...(appearance?.background?{'--card-background':appearance.background}:{}),
    ...(appearance?.border?{'--card-border':appearance.border}:{}),
    ...(palette?{'--card-text':palette.text,'--card-muted':palette.muted,'--card-bar':palette.bar,
      '--card-track':palette.track,'--card-control':palette.track,'--card-separator':palette.separator,'--card-focus':palette.text}:{})};
}

// Canvas decoration adapts separately from each card's own appearance.
export function workspaceColorStyles(value) {
  const background=cleanColor(value);if(!background)return {};
  const palette=readablePalette(background);
  return {'--workspace-ink':palette.text,'--workspace-line':palette.muted,'--workspace-grid':blend(background,palette.text,.22)};
}
