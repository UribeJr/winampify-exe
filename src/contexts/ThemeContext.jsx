import React, { createContext, useContext, useState, useEffect } from 'react';
import { getThemeById } from '../data/themes';

const STORAGE_KEY = 'winampify-theme';
const DEFAULT_THEME = 'default';

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
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

