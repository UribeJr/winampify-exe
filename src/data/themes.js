export const themes = {
  default: {
    id: 'default',
    name: 'Windows Default',
    fileName: 'Windows Default.theme',
    colors: {
      titleBarActiveStart: '#000080',
      titleBarActiveEnd: '#000080',
      titleBarInactive: '#000080',
      taskbar: '#c6c6c6',
      taskbarButton: '#c6c6c6',
      taskbarButtonHover: '#d4d0c8',
      taskbarButtonActive: '#c6c6c6',
      windowBorder: '#c0c0c0',
    }
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    fileName: 'Rose (high color).theme',
    colors: {
      titleBarActiveStart: '#800080',
      titleBarActiveEnd: '#d040d0',
      titleBarInactive: '#808080',
      taskbar: '#d4c0d4',
      taskbarButton: '#d4c0d4',
      taskbarButtonHover: '#e0d0e0',
      taskbarButtonActive: '#d4c0d4',
      windowBorder: '#c0c0c0',
    }
  },
  teal: {
    id: 'teal',
    name: 'Teal',
    fileName: 'Teal (high color).theme',
    colors: {
      titleBarActiveStart: '#008080',
      titleBarActiveEnd: '#40c0c0',
      titleBarInactive: '#808080',
      taskbar: '#c0d4d4',
      taskbarButton: '#c0d4d4',
      taskbarButtonHover: '#d0e0e0',
      taskbarButtonActive: '#c0d4d4',
      windowBorder: '#c0c0c0',
    }
  },
  green: {
    id: 'green',
    name: 'Green',
    fileName: 'Green (high color).theme',
    colors: {
      titleBarActiveStart: '#808000',
      titleBarActiveEnd: '#c0d040',
      titleBarInactive: '#808080',
      taskbar: '#d4d4c0',
      taskbarButton: '#d4d4c0',
      taskbarButtonHover: '#e0e0d0',
      taskbarButtonActive: '#d4d4c0',
      windowBorder: '#c0c0c0',
    }
  },
  earth: {
    id: 'earth',
    name: 'Earth',
    fileName: 'Earth.theme',
    colors: {
      titleBarActiveStart: '#B9B28A',
      titleBarActiveEnd: '#B9B28A',
      titleBarInactive: '#B9B28A',
      taskbar: '#c6c6c6',
      taskbarButton: '#c6c6c6',
      taskbarButtonHover: '#d4d0c8',
      taskbarButtonActive: '#c6c6c6',
      windowBorder: '#c0c0c0',
    }
  }
};

export const getThemeList = () => Object.values(themes);
export const getThemeById = (id) => themes[id] || themes.default;

