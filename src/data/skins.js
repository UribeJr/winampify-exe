// Skins change the whole look (98.css vs xp.css); color schemes are per skin.
import { getThemeList, themes } from './themes.js';

export const SKINS = [
  { id: '98', name: 'Windows 98 Classic' },
  { id: 'xp', name: 'Windows XP style' }
];
export const DEFAULT_SKIN = '98';

// XP color schemes; the colors themselves live in skin-xp.css (they're gradients)
export const XP_SCHEMES = [
  { id: 'xp-blue', name: 'Default (blue)', preview: { title: '#0058ee', taskbar: '#245edb' } },
  { id: 'xp-olive', name: 'Olive Green', preview: { title: '#8ba169', taskbar: '#8ca468' } },
  { id: 'xp-silver', name: 'Silver', preview: { title: '#a8a8c0', taskbar: '#b8b8cc' } }
];

const DEFAULT_SCHEME = { 98: 'default', xp: 'xp-blue' };

export const normalizeSkin = (id) => (SKINS.some((s) => s.id === id) ? id : DEFAULT_SKIN);

export const getSchemesForSkin = (skin) => (normalizeSkin(skin) === 'xp' ? XP_SCHEMES : getThemeList());

export const defaultSchemeFor = (skin) => DEFAULT_SCHEME[normalizeSkin(skin)];

// A saved scheme id that's valid for this skin, or the skin's default
export function resolveScheme(skin, savedId) {
  const list = getSchemesForSkin(skin);
  return list.some((s) => s.id === savedId) ? savedId : defaultSchemeFor(skin);
}

export const isXpScheme = (id) => XP_SCHEMES.some((s) => s.id === id);

export { themes };
