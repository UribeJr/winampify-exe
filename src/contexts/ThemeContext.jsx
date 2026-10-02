import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getThemeById } from '../data/themes';
import { DEFAULT_WALLPAPER, CUSTOM_WALLPAPER_ID, MODES, getWallpaper, wallpaperStyle } from '../data/wallpapers';

const STORAGE_KEY = 'winampify-theme';
const DEFAULT_THEME = 'default';
const WALLPAPER_KEY = 'winampify-wallpaper';
const CUSTOM_WALLPAPER_KEY = 'winampify-wallpaper-custom';

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

  // Apply theme to document
  useEffect(() => {
    // Set data-theme attribute on document element
    document.documentElement.setAttribute('data-theme', currentThemeId);
    
    // Apply CSS variables
    const root = document.documentElement;
    const colors = currentTheme.colors;
    
    root.style.setProperty('--theme-title-bar-active-start', colors.titleBarActiveStart);
    root.style.setProperty('--theme-title-bar-active-end', colors.titleBarActiveEnd);
    root.style.setProperty('--theme-title-bar-inactive', colors.titleBarInactive);
    root.style.setProperty('--theme-taskbar', colors.taskbar);
    root.style.setProperty('--theme-taskbar-button', colors.taskbarButton);
    root.style.setProperty('--theme-taskbar-button-hover', colors.taskbarButtonHover);
    root.style.setProperty('--theme-taskbar-button-active', colors.taskbarButtonActive);
    root.style.setProperty('--theme-window-border', colors.windowBorder);
  }, [currentThemeId, currentTheme]);

  const setTheme = (themeId) => {
    setCurrentThemeId(themeId);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // storage blocked; theme still applies for this visit
    }
  };

  const value = {
    currentTheme,
    currentThemeId,
    setTheme,
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

