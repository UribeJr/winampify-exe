// The visualization catalog, WMP 7 style: collections you step through with ◀ ▶.
// Classics are drawn by ClassicVisualizer.jsx; the rest are MilkDrop presets (butterchurn).
// The full MilkDrop library is appended at runtime by the (lazy) Visualizer chunk.

export const CLASSICS = [
  { id: 'bars', name: 'Bars and Waves', group: 'Classics', type: 'bars' },
  { id: 'scope', name: 'Scope', group: 'Classics', type: 'scope' },
  { id: 'dots', name: 'Dots', group: 'Classics', type: 'dots' }
];

// Hand-picked MilkDrop presets, named after the WMP 7-era visualizations they resemble
export const PICKS = [
  { id: 'md-alchemy', name: 'Alchemy', group: 'Winampify', type: 'milkdrop', presetKey: 'Flexi, martin + geiss - dedicated to the sherwin maxawow' },
  { id: 'md-battery', name: 'Battery', group: 'Winampify', type: 'milkdrop', presetKey: 'Rovastar + Geiss - Dynamic Swirls 2 (Abstract mix)' },
  { id: 'md-particle', name: 'Particle', group: 'Winampify', type: 'milkdrop', presetKey: 'flexi - abstract 03' },
  { id: 'md-ambience', name: 'Ambience', group: 'Winampify', type: 'milkdrop', presetKey: 'Geiss - Oldskool 02' },
  { id: 'md-solid', name: 'Solid', group: 'Winampify', type: 'milkdrop', presetKey: 'Unchained - God of the Game (Remix)' }
];

export const BUILT_IN = [...CLASSICS, ...PICKS];
export const DEFAULT_VIZ_ID = 'bars';
export const AUTO_CHANGE_MS = 30 * 1000;

// MilkDrop library entries from butterchurn-presets keys (skipping the hand-picked ones)
export function libraryEntries(presetKeys) {
  const picked = new Set(PICKS.map((p) => p.presetKey));
  return presetKeys
    .filter((key) => !picked.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ id: `lib:${key}`, name: key, group: 'MilkDrop library', type: 'milkdrop', presetKey: key }));
}

const indexOf = (list, id) => Math.max(0, list.findIndex((v) => v.id === id));

export const nextViz = (list, id) => list[(indexOf(list, id) + 1) % list.length];
export const prevViz = (list, id) => list[(indexOf(list, id) - 1 + list.length) % list.length];

// A random visualization that isn't the current one
export function randomViz(list, id, random = Math.random) {
  const pool = list.filter((v) => v.id !== id);
  if (!pool.length) return list[0];
  return pool[Math.floor(random() * pool.length)];
}

// Saved id → a visualization in the list (falls back to the default)
export const restoreViz = (list, savedId) =>
  list.find((v) => v.id === savedId) || list.find((v) => v.id === DEFAULT_VIZ_ID) || list[0];

export const vizLabel = (viz) => `${viz.group} : ${viz.name}`;

// Groups in display order, for the picker menu
export function groupViz(list) {
  const groups = new Map();
  list.forEach((v) => {
    if (!groups.has(v.group)) groups.set(v.group, []);
    groups.get(v.group).push(v);
  });
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
}

// Remembered between visits
const STORAGE_KEY = 'winampify-visualization';

export function loadVizPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return { id: typeof saved.id === 'string' ? saved.id : DEFAULT_VIZ_ID, autoChange: Boolean(saved.autoChange) };
  } catch {
    return { id: DEFAULT_VIZ_ID, autoChange: false };
  }
}

export function saveVizPrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
}
