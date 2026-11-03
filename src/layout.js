import { cleanPurpose, purposeBlocks } from './cardPurpose.js';
import { fullGameMetrics } from './catalog.js';
import { cleanBlocks, contentMinimum, designFits } from './cardDesign.js';
import { cleanCardAppearance, cleanColor } from './appearance.js';

export const layoutStorageKey = 'courtside:custom-layouts:v1';
export const cardSize = { width: 260, height: 190 };
export const cardLimits = { minWidth: 260, minHeight: 190, maxWidth: 1200, maxHeight: 1000 };
const dimension = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value / 10) * 10)) : fallback;
export const dimensions = card => ({
  width: dimension(card?.width, cardSize.width, cardLimits.minWidth, cardLimits.maxWidth),
  height: dimension(card?.height, cardSize.height, cardLimits.minHeight, cardLimits.maxHeight),
});
// Applied designs establish a minimum outer size. Grow freely; shrinking stops
// at the content edges rather than silently clipping or relocating blocks.
export function resizeDimensions(card, patch) {
  const size = dimensions({ ...card, ...patch }), min = contentMinimum(card);
  return { width: Math.max(size.width, Math.ceil(min.width/10)*10), height: Math.max(size.height, Math.ceil(min.height/10)*10) };
}
export const blankLayout = () => ({ name: '', cards: [], links: [], groups: [] });
const validMetric = key => fullGameMetrics.some(([id]) => id === key);
export const snap = value => Math.max(0, Math.min(10000, Math.round(value / 20) * 20));

// Only layout definitions are persisted, never team values or provider records.
// Ignore malformed/obsolete data and dangling or duplicate visual connections.
export function cleanLayout(value) {
  const seen = new Set();
  const cards = (Array.isArray(value?.cards) ? value.cards : []).filter(c => {
    if (!c || typeof c.id !== 'string' || !c.id || seen.has(c.id) || !validMetric(c.metric) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    seen.add(c.id); return true;
  }).slice(0, 100).map(c => {
    const card = { id: c.id, metric: c.metric, x: snap(c.x), y: snap(c.y), ...dimensions(c) };
    const purpose = cleanPurpose(c);
    const rawBlocks = cleanBlocks(c.blocks, card);
    const blocks = rawBlocks === null ? null : purposeBlocks(rawBlocks,purpose);
    const appearance=cleanCardAppearance(c.appearance);
    return {...card,...purpose,...(blocks===null?{}:{blocks}),...(appearance?{appearance}:{})};
  });
  const ids = new Set(cards.map(c => c.id)), edges = new Set();
  const links = (Array.isArray(value?.links) ? value.links : []).filter(l => {
    if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to) return false;
    const key = [l.from, l.to].sort().join('|');
    if (edges.has(key)) return false;
    edges.add(key); return true;
  }).map(l => ({ from: l.from, to: l.to }));
  // A card belongs to at most one group. Old layouts simply have no groups;
  // malformed, duplicate and one-card groups are discarded on load/removal.
  const grouped = new Set(), groupIds = new Set();
  const groups = (Array.isArray(value?.groups) ? value.groups : []).flatMap(g => {
    if (typeof g?.id !== 'string' || !g.id || groupIds.has(g.id)) return [];
    const members = [...new Set(Array.isArray(g.cards) ? g.cards : [])].filter(id => ids.has(id) && !grouped.has(id));
    if (members.length < 2) return [];
    groupIds.add(g.id); members.forEach(id => grouped.add(id));
    return [{ id: g.id, cards: members }];
  });
  const background=cleanColor(value?.background);
  return { name: typeof value?.name === 'string' ? value.name.slice(0, 80) : '', cards, links, groups, ...(background?{background}:{}) };
}

export function readLayoutLibrary(storage) {
  try {
    const saved = JSON.parse(storage.getItem(layoutStorageKey));
    if (saved?.version !== 1) return [];
    return (Array.isArray(saved.layouts) ? saved.layouts : []).filter(l => typeof l?.id === 'string')
      .map(l => ({ id: l.id, ...cleanLayout(l) }));
  } catch { return []; }
}

// Removing a card also removes its lines. Different cards may use the same stat.
export function removeCard(layout, id) {
  return cleanLayout({ ...layout, cards: layout.cards.filter(c => c.id !== id), links: layout.links.filter(l => l.from !== id && l.to !== id) });
}
export function connectCards(layout, from, to) {
  return cleanLayout({ ...layout, links: [...layout.links, { from, to }] });
}

// Find an unoccupied grid position for a new card without moving existing cards.
export function nextCardPosition(cards) {
  for (let i = 0; i <= cards.length * 20; i++) {
    const point = { x: 20 + i % 3 * 300, y: 20 + Math.floor(i / 3) * 220 };
    if (!cards.some(c => point.x < c.x + dimensions(c).width + 20 && point.x + cardSize.width + 20 > c.x
      && point.y < c.y + dimensions(c).height + 20 && point.y + cardSize.height + 20 > c.y)) return point;
  }
  return { x: 20, y: snap(Math.max(...cards.map(c => c.y + dimensions(c).height), 0) + 20) };
}

// Arrange respects varying sizes, rather than putting oversized cards on top
// of their neighbors. This is an explicit, undoable action, not auto-grouping.
export function arrangeCards(cards) {
  let x = 20, y = 20, rowHeight = 0;
  return cards.map(card => {
    const size = dimensions(card);
    if (x > 20 && x + size.width > 960) { x = 20; y += rowHeight + 30; rowHeight = 0; }
    const result = { ...card, ...size, x: snap(x), y: snap(y) };
    x = result.x + size.width + 30; rowHeight = Math.max(rowHeight, size.height);
    return result;
  });
}

export const groupFor = (layout, cardId) => layout.groups?.find(g => g.cards.includes(cardId));
export function groupBounds(layout, group) {
  const cards = layout.cards.filter(c => group.cards.includes(c.id));
  const x = Math.min(...cards.map(c => c.x)), y = Math.min(...cards.map(c => c.y));
  return { x, y, width: Math.max(...cards.map(c => c.x + c.width)) - x,
    height: Math.max(...cards.map(c => c.y + c.height)) - y };
}

// Clamp one shared delta, not each member independently, so boundaries never
// squash a group or change its internal spacing. Inputs use canvas units.
export function moveCards(layout, ids, dx, dy) {
  const cards = layout.cards.filter(c => ids.includes(c.id));
  if (!cards.length) return layout;
  const clamp = (delta, key) => Math.max(-Math.min(...cards.map(c => c[key])),
    Math.min(10000 - Math.max(...cards.map(c => c[key])), Math.round(delta / 20) * 20));
  const x = clamp(dx, 'x'), y = clamp(dy, 'y');
  return { ...layout, cards: layout.cards.map(c => ids.includes(c.id) ? { ...c, x: c.x + x, y: c.y + y } : c) };
}

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

// Only an overlapping, ungrouped card can join a target. Preview exactly the
// eventual placement, including the matched height (side) or width (stack).
// Reject blocked/out-of-bounds positions instead of hiding another card.
export function magneticPreview(layout, movingId) {
  if (groupFor(layout, movingId)) return null;
  const moving = layout.cards.find(c => c.id === movingId);
  if (!moving) return null;
  const targets = layout.cards.filter(c => c.id !== movingId && overlaps(moving, c))
    .sort((a, b) => Math.hypot(moving.x-a.x, moving.y-a.y) - Math.hypot(moving.x-b.x, moving.y-b.y));
  for (const target of targets) {
    const dx = (moving.x + moving.width/2 - target.x - target.width/2) / target.width;
    const dy = (moving.y + moving.height/2 - target.y - target.height/2) / target.height;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sides = horizontal ? (dx >= 0 ? ['right','left','below','above'] : ['left','right','below','above'])
      : (dy >= 0 ? ['below','above','right','left'] : ['above','below','right','left']);
    for (const side of sides) {
      const beside = side === 'right' || side === 'left';
      const card = { ...moving, width: beside ? moving.width : target.width, height: beside ? target.height : moving.height,
        x: beside ? Math.round((side === 'right' ? target.x + target.width + 20 : target.x - moving.width - 20)/20)*20 : target.x,
        y: beside ? target.y : Math.round((side === 'below' ? target.y + target.height + 20 : target.y - moving.height - 20)/20)*20 };
      if (card.x < 0 || card.y < 0 || card.x > 10000 || card.y > 10000) continue;
      if (!designFits(card)) continue;
      if (layout.cards.some(c => c.id !== movingId && overlaps(card, c))) continue;
      return { targetId: target.id, card, side };
    }
  }
  return null;
}

export function applyMagnet(layout, preview, newGroupId) {
  if (!preview || groupFor(layout, preview.card.id)) return layout;
  const targetGroup = groupFor(layout, preview.targetId);
  const groups = targetGroup ? layout.groups.map(g => g.id === targetGroup.id ? { ...g, cards: [...g.cards, preview.card.id] } : g)
    : [...layout.groups, { id: newGroupId, cards: [preview.targetId, preview.card.id] }];
  return cleanLayout({ ...layout, cards: layout.cards.map(c => c.id === preview.card.id ? preview.card : c), groups });
}
export const ungroup = (layout, id) => ({ ...layout, groups: layout.groups.filter(g => g.id !== id) });

// Arrange whole groups as units; preserve internal positions and membership.
export function arrangeLayout(layout) {
  let x = 20, y = 40, rowHeight = 0;
  const visited = new Set();
  let result = layout;
  for (const card of layout.cards) {
    if (visited.has(card.id)) continue;
    const group = groupFor(layout, card.id), ids = group?.cards || [card.id];
    ids.forEach(id => visited.add(id));
    const box = group ? groupBounds(layout, group) : card;
    if (x > 20 && x + box.width > 960) { x = 20; y = snap(y + rowHeight + 60); rowHeight = 0; }
    result = moveCards(result, ids, x-box.x, y-box.y);
    x = snap(x + box.width + 40); rowHeight = Math.max(rowHeight, box.height);
  }
  return result;
}

// Session-only immutable history. Gestures may preview many positions/sizes;
// committing with their original snapshot records exactly one undo action.
export const createHistory = layout => ({ past: [], present: cleanLayout(layout), future: [] });
export function commitHistory(history, layout, before = history.present) {
  const next = cleanLayout(layout), previous = cleanLayout(before);
  if (JSON.stringify(next) === JSON.stringify(previous)) return { ...history, present: next };
  return { past: [...history.past, previous].slice(-100), present: next, future: [] };
}
export function undoHistory(history) {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past.at(-1), future: [history.present, ...history.future] };
}
export function redoHistory(history) {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present].slice(-100), present: history.future[0], future: history.future.slice(1) };
}
