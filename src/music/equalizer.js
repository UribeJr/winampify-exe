// Graphic equalizer settings, WMP 7 style: 10 bands, ±12 dB, presets.
// Pure helpers (unit-tested); useAudioEngine applies them to Web Audio filters.

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const MAX_DB = 12;
export const CUSTOM_PRESET = 'custom';

const preset = (id, name, gains) => ({ id, name, gains });

export const EQ_PRESETS = [
  preset('flat', 'Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  preset('rock', 'Rock', [5, 4, 2, -1, -2, -1, 2, 4, 5, 5]),
  preset('pop', 'Pop', [-1, 1, 3, 4, 3, 0, -1, -1, 0, 1]),
  preset('jazz', 'Jazz', [3, 2, 1, 2, -1, -1, 0, 1, 2, 3]),
  preset('classical', 'Classical', [4, 3, 2, 0, -1, -1, 0, 2, 3, 4]),
  preset('dance', 'Dance', [6, 5, 3, 0, 0, -2, -3, -2, 0, 1]),
  preset('hiphop', 'Hip Hop', [6, 5, 2, 3, -1, -1, 1, -1, 1, 2]),
  preset('acoustic', 'Acoustic', [3, 3, 2, 1, 2, 2, 3, 3, 2, 1]),
  preset('vocal', 'Vocal', [-2, -2, -1, 1, 4, 4, 3, 1, 0, -1]),
  preset('bass', 'Bass Boost', [7, 6, 4, 2, 0, 0, 0, 0, 0, 0]),
  preset('treble', 'Treble Boost', [0, 0, 0, 0, 0, 1, 3, 5, 6, 7]),
  preset('loudness', 'Loudness', [5, 4, 1, 0, -1, 0, 0, 1, 4, 5])
];

export const DEFAULT_EQ = { enabled: false, presetId: 'flat', gains: EQ_PRESETS[0].gains };

export const clampGain = (db) => {
  const n = Number(db);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_DB, Math.min(MAX_DB, Math.round(n * 2) / 2)); // half-dB steps
};

// 31 → "31", 1000 → "1K", 16000 → "16K"
export const bandLabel = (hz) => (hz >= 1000 ? `${hz / 1000}K` : String(hz));

export const presetGains = (id) => (EQ_PRESETS.find((p) => p.id === id) || EQ_PRESETS[0]).gains;

// The preset these gains match exactly, or "custom"
export function matchPreset(gains) {
  const found = EQ_PRESETS.find((p) => p.gains.every((g, i) => g === gains[i]));
  return found ? found.id : CUSTOM_PRESET;
}

// Saved/untrusted settings → a valid settings object
export function normalizeEq(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_EQ;
  const gains = EQ_BANDS.map((_, i) => clampGain(Array.isArray(saved.gains) ? saved.gains[i] : 0));
  return { enabled: Boolean(saved.enabled), presetId: matchPreset(gains), gains };
}

export const withGain = (eq, index, db) => {
  const gains = eq.gains.map((g, i) => (i === index ? clampGain(db) : g));
  return { ...eq, gains, presetId: matchPreset(gains) };
};

export const withPreset = (eq, id) => ({ ...eq, presetId: id, gains: presetGains(id) });

// Headroom: lower the input by half the biggest boost so boosted bands don't clip
export const preampDb = (eq) => {
  const boost = eq.enabled ? Math.max(0, ...eq.gains) : 0;
  return boost ? -boost / 2 : 0;
};

export const dbToGain = (db) => 10 ** (db / 20);

// What each filter should be set to (bypassed = all 0 dB)
export const filterGains = (eq) => (eq.enabled ? eq.gains : EQ_BANDS.map(() => 0));

const STORAGE_KEY = 'winampify-equalizer';

export function loadEq() {
  try { return normalizeEq(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return DEFAULT_EQ; }
}

export function saveEq(eq) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: eq.enabled, gains: eq.gains })); } catch { /* storage blocked */ }
}
