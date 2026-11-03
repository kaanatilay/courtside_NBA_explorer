import { fullGameMetrics } from './catalog.js';

export const layoutStorageKey = 'courtside:custom-layouts:v1';
export const cardSize = { width: 260, height: 190 };
export const blankLayout = () => ({ name: '', cards: [], links: [] });
const validMetric = key => fullGameMetrics.some(([id]) => id === key);
export const snap = value => Math.max(0, Math.min(10000, Math.round(value / 20) * 20));

// Only layout definitions are persisted, never team values or provider records.
// Ignore malformed/obsolete data and dangling or duplicate visual connections.
export function cleanLayout(value) {
  const seen = new Set();
  const cards = (Array.isArray(value?.cards) ? value.cards : []).filter(c => {
    if (!c || typeof c.id !== 'string' || !c.id || seen.has(c.id) || !validMetric(c.metric) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    seen.add(c.id); return true;
  }).slice(0, 100).map(c => ({ id: c.id, metric: c.metric, x: snap(c.x), y: snap(c.y) }));
  const ids = new Set(cards.map(c => c.id)), edges = new Set();
  const links = (Array.isArray(value?.links) ? value.links : []).filter(l => {
    if (!l || !ids.has(l.from) || !ids.has(l.to) || l.from === l.to) return false;
    const key = [l.from, l.to].sort().join('|');
    if (edges.has(key)) return false;
    edges.add(key); return true;
  }).map(l => ({ from: l.from, to: l.to }));
  return { name: typeof value?.name === 'string' ? value.name.slice(0, 80) : '', cards, links };
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
  return { ...layout, cards: layout.cards.filter(c => c.id !== id), links: layout.links.filter(l => l.from !== id && l.to !== id) };
}
export function connectCards(layout, from, to) {
  return cleanLayout({ ...layout, links: [...layout.links, { from, to }] });
}

// Find an unoccupied grid position for a new card without moving existing cards.
export function nextCardPosition(cards) {
  for (let i = 0; i <= cards.length; i++) {
    const point = { x: 20 + i % 3 * 300, y: 20 + Math.floor(i / 3) * 220 };
    if (!cards.some(c => Math.abs(c.x - point.x) < cardSize.width + 20 && Math.abs(c.y - point.y) < cardSize.height + 20)) return point;
  }
  return { x: 20, y: snap(Math.max(...cards.map(c => c.y), 0) + 220) };
}
