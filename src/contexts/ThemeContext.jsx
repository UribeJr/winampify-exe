import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getThemeById } from '../data/themes';
import { DEFAULT_WALLPAPER, CUSTOM_WALLPAPER_ID, MODES, getWallpaper, wallpaperStyle } from '../data/wallpapers';
import { normalizeSkin, resolveScheme, isStyledSkin } from '../data/skins';
import { loadSkinStyles } from '../styles/loadSkin';

const STORAGE_KEY = 'winampify-theme';
const DEFAULT_THEME = 'default';
const WALLPAPER_KEY = 'winampify-wallpaper';
const CUSTOM_WALLPAPER_KEY = 'winampify-wallpaper-custom';
const SKIN_KEY = 'winampify-skin'; // read before first paint by index.html
// Each styled skin remembers its own color scheme (98 keeps using STORAGE_KEY)
const SCHEME_KEYS = { xp: 'winampify-xp-scheme', 7: 'winampify-7-scheme' };
const GLASS_KEY = 'winampify-7-glass'; // also read before first paint by index.html
const THEME_VARS = [
  '--theme-title-bar-active-start', '--theme-title-bar-active-end', '--theme-title-bar-inactive', '--theme-taskbar',
  '--theme-taskbar-button', '--theme-taskbar-button-hover', '--theme-taskbar-button-active', '--theme-window-border'
];

const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const loadWallpaper = (hasCustom) => {
  try {
    const saved = JSON.parse(readStorage(WALLPAPER_KEY));
    const known = saved?.id === CUSTOM_WALLPAPER_ID ? hasCustom : getWallpaper(saved?.id);
    if (known && MODES[saved.mode]) return { id: saved.id, mode: saved.mode };
  } catch { /* fall through to the default */ }
  return DEFAULT_WALLPAPER;
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    // Classic navy suits the teal Win98 wallpaper; the saved choice wins
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  const currentTheme = getThemeById(currentThemeId);

  // Skin: index.html sets data-skin before paint and index.jsx loads that skin's stylesheets
  // (removing the attribute if that fails), so the attribute is the source of truth at startup
  const [skin, setSkinState] = useState(() => normalizeSkin(document.documentElement.getAttribute('data-skin')));
  const [skinSchemes, setSkinSchemes] = useState(() => Object.fromEntries(
    Object.entries(SCHEME_KEYS).map(([id, key]) => [id, resolveScheme(id, readStorage(key))])
  ));
  // Windows 7 Aero glass (phones always get solid colors, in CSS)
  const [transparency, setTransparencyState] = useState(() => readStorage(GLASS_KEY) !== 'off');

  // Desktop wallpaper: a built-in or the user's own picture (a data URL kept only in this browser)
  const [customWallpaper, setCustomWallpaperState] = useState(() => readStorage(CUSTOM_WALLPAPER_KEY));
  const [wallpaper, setWallpaperState] = useState(() => loadWallpaper(Boolean(readStorage(CUSTOM_WALLPAPER_KEY))));

  useEffect(() => {
    const root = document.documentElement;
    const style = wallpaperStyle(wallpaper, customWallpaper);
    root.style.setProperty('--wallpaper-image', style.image);
    root.style.setProperty('--wallpaper-size', style.size);
    root.style.setProperty('--wallpaper-repeat', style.repeat);
    root.style.setProperty('--wallpaper-position', style.position);
  }, [wallpaper, customWallpaper]);

  const setWallpaper = useCallback((id, mode) => {
    const next = { id, mode: MODES[mode] ? mode : 'center' };
    setWallpaperState(next);
    try { localStorage.setItem(WALLPAPER_KEY, JSON.stringify(next)); } catch { /* this visit only */ }
  }, []);

  // Returns false when the picture is too big to remember (storage quota); it still shows this visit
  const setCustomWallpaper = useCallback((dataUrl) => {
    setCustomWallpaperState(dataUrl);
    try {
      localStorage.setItem(CUSTOM_WALLPAPER_KEY, dataUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearCustomWallpaper = useCallback(() => {
    setCustomWallpaperState(null);
    try { localStorage.removeItem(CUSTOM_WALLPAPER_KEY); } catch { /* storage blocked */ }
    setWallpaperState((current) => {
      if (current.id !== CUSTOM_WALLPAPER_ID) return current;
      try { localStorage.setItem(WALLPAPER_KEY, JSON.stringify(DEFAULT_WALLPAPER)); } catch { /* storage blocked */ }
      return DEFAULT_WALLPAPER;
    });
  }, []);

  // Apply skin + color scheme to the document
  useEffect(() => {
    const root = document.documentElement;
    if (transparency) root.setAttribute('data-glass', 'on');
    else root.removeAttribute('data-glass');
    if (isStyledSkin(skin)) {
      root.setAttribute('data-skin', skin);
      root.setAttribute('data-theme', skinSchemes[skin]);
      THEME_VARS.forEach((name) => root.style.removeProperty(name)); // these schemes live in the skin's CSS
      return;
    }
    root.removeAttribute('data-skin');
    root.setAttribute('data-theme', currentThemeId);
    const colors = currentTheme.colors;
    root.style.setProperty('--theme-title-bar-active-start', colors.titleBarActiveStart);
    root.style.setProperty('--theme-title-bar-active-end', colors.titleBarActiveEnd);
    root.style.setProperty('--theme-title-bar-inactive', colors.titleBarInactive);
    root.style.setProperty('--theme-taskbar', colors.taskbar);
    root.style.setProperty('--theme-taskbar-button', colors.taskbarButton);
    root.style.setProperty('--theme-taskbar-button-hover', colors.taskbarButtonHover);
    root.style.setProperty('--theme-taskbar-button-active', colors.taskbarButtonActive);
    root.style.setProperty('--theme-window-border', colors.windowBorder);
  }, [skin, skinSchemes, transparency, currentThemeId, currentTheme]);

  const setTheme = (themeId) => {
    setCurrentThemeId(themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // storage blocked; theme still applies for this visit
    }
  };

  // Switch skin, scheme and (7) transparency. The skin's stylesheets load first, so nothing
  // flashes unstyled. Resolves false (and keeps the current look) if they can't be fetched.
  const setAppearance = useCallback(async (nextSkin, schemeId, options = {}) => {
    const target = normalizeSkin(nextSkin);
    if (typeof options.transparency === 'boolean') {
      setTransparencyState(options.transparency);
      try { localStorage.setItem(GLASS_KEY, options.transparency ? 'on' : 'off'); } catch { /* this visit only */ }
    }
    if (isStyledSkin(target)) {
      try { await loadSkinStyles(target); } catch { return false; }
      const scheme = resolveScheme(target, schemeId);
      setSkinSchemes((all) => ({ ...all, [target]: scheme }));
      try { localStorage.setItem(SCHEME_KEYS[target], scheme); } catch { /* this visit only */ }
    } else {
      setTheme(resolveScheme('98', schemeId));
    }
    setSkinState(target);
    try { localStorage.setItem(SKIN_KEY, target); } catch { /* this visit only */ }
    return true;
  }, []);

  const value = {
    currentTheme,
    currentThemeId,
    setTheme,
    skin,
    schemeId: isStyledSkin(skin) ? skinSchemes[skin] : currentThemeId,
    transparency,
    setAppearance,
    wallpaper,
    customWallpaper,
    setWallpaper,
    setCustomWallpaper,
    clearCustomWallpaper
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

