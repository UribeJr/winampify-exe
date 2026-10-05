import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getThemeById } from '../data/themes';
import { DEFAULT_WALLPAPER, CUSTOM_WALLPAPER_ID, MODES, getWallpaper, wallpaperStyle } from '../data/wallpapers';
import { normalizeSkin, resolveScheme } from '../data/skins';
import { loadXpSkin } from '../styles/loadSkin';

const STORAGE_KEY = 'winampify-theme';
const DEFAULT_THEME = 'default';
const WALLPAPER_KEY = 'winampify-wallpaper';
const CUSTOM_WALLPAPER_KEY = 'winampify-wallpaper-custom';
const SKIN_KEY = 'winampify-skin'; // read before first paint by index.html
const XP_SCHEME_KEY = 'winampify-xp-scheme';
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

  // Skin: index.html sets data-skin="xp" before paint and index.jsx loads the XP stylesheets
  // (removing the attribute if that fails), so the attribute is the source of truth at startup
  const [skin, setSkinState] = useState(() => normalizeSkin(document.documentElement.getAttribute('data-skin')));
  const [xpScheme, setXpScheme] = useState(() => resolveScheme('xp', readStorage(XP_SCHEME_KEY)));

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
    if (skin === 'xp') {
      root.setAttribute('data-skin', 'xp');
      root.setAttribute('data-theme', xpScheme);
      THEME_VARS.forEach((name) => root.style.removeProperty(name)); // XP schemes live in skin-xp.css
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
  }, [skin, xpScheme, currentThemeId, currentTheme]);

  const setTheme = (themeId) => {
    setCurrentThemeId(themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // storage blocked; theme still applies for this visit
    }
  };

  // Switch skin and/or scheme. XP's stylesheets load first, so nothing flashes unstyled.
  // Resolves false (and keeps the current look) if they can't be fetched.
  const setAppearance = useCallback(async (nextSkin, schemeId) => {
    const target = normalizeSkin(nextSkin);
    if (target === 'xp') {
      try { await loadXpSkin(); } catch { return false; }
      const scheme = resolveScheme('xp', schemeId);
      setXpScheme(scheme);
      try { localStorage.setItem(XP_SCHEME_KEY, scheme); } catch { /* this visit only */ }
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
    schemeId: skin === 'xp' ? xpScheme : currentThemeId,
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

