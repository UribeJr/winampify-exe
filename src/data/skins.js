// Skins change the whole look (98.css, xp.css or 7.css); color schemes are per skin.
// Non-98 skins set <html data-skin="…">, their stylesheets load lazily (styles/loadSkin.js)
// and their scheme colors live in that skin's CSS (they're gradients).
import { getThemeList, themes } from './themes.js';

export const SKINS = [
  { id: '98', name: 'Windows 98 Classic' },
  { id: 'xp', name: 'Windows XP style' },
  { id: '7', name: 'Windows 7 style' }
];
export const DEFAULT_SKIN = '98';

export const XP_SCHEMES = [
  { id: 'xp-blue', name: 'Default (blue)', preview: { title: '#0058ee', taskbar: '#245edb' } },
  { id: 'xp-olive', name: 'Olive Green', preview: { title: '#8ba169', taskbar: '#8ca468' } },
  { id: 'xp-silver', name: 'Silver', preview: { title: '#a8a8c0', taskbar: '#b8b8cc' } }
];

// Windows 7 "window colors"
export const SEVEN_SCHEMES = [
  { id: '7-sky', name: 'Sky', preview: { title: '#8fbfe8', taskbar: '#2b4a6b' } },
  { id: '7-twilight', name: 'Twilight', preview: { title: '#3b6fb6', taskbar: '#1d2f4d' } },
  { id: '7-sea', name: 'Sea', preview: { title: '#4fb3a9', taskbar: '#1f4a47' } },
  { id: '7-leaf', name: 'Leaf', preview: { title: '#7cbf5a', taskbar: '#2f4a22' } },
  { id: '7-violet', name: 'Violet', preview: { title: '#9b7fd0', taskbar: '#3a2d55' } },
  { id: '7-chocolate', name: 'Chocolate', preview: { title: '#a07a5c', taskbar: '#3d2c20' } },
  { id: '7-frost', name: 'Frost', preview: { title: '#d8e2ec', taskbar: '#5c6b78' } }
];

const SCHEMES = { 98: () => getThemeList(), xp: () => XP_SCHEMES, 7: () => SEVEN_SCHEMES };
const DEFAULT_SCHEME = { 98: 'default', xp: 'xp-blue', 7: '7-sky' };
// Each modern skin offers a matching original wallpaper (see data/wallpapers.js)
const WALLPAPER = { xp: 'xp-hills', 7: 'aurora' };

export const normalizeSkin = (id) => (SKINS.some((s) => s.id === id) ? id : DEFAULT_SKIN);

// Skins that load extra stylesheets and set <html data-skin>
export const isStyledSkin = (id) => normalizeSkin(id) !== DEFAULT_SKIN;

export const getSchemesForSkin = (skin) => SCHEMES[normalizeSkin(skin)]();

export const defaultSchemeFor = (skin) => DEFAULT_SCHEME[normalizeSkin(skin)];

// A saved scheme id that's valid for this skin, or the skin's default
export function resolveScheme(skin, savedId) {
  const list = getSchemesForSkin(skin);
  return list.some((s) => s.id === savedId) ? savedId : defaultSchemeFor(skin);
}

export const skinWallpaper = (skin) => WALLPAPER[normalizeSkin(skin)] || null;

export { themes };
