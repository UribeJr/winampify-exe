import React, { useState } from 'react';
import Dialog, { DialogButtons } from './Dialog';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeList } from '../data/themes';

// Stand-in for the portfolio's Theme Explorer app: pick a desktop theme and preview it.
const ThemesDialog = ({ onClose }) => {
  const { currentThemeId, setTheme } = useTheme();
  const [selected, setSelected] = useState(currentThemeId);
  const themes = getThemeList();
  const preview = themes.find((t) => t.id === selected) || themes[0];

  const apply = () => setTheme(selected);

  return (
    <Dialog title="Desktop Themes" icon="themes" onClose={onClose} className="themes-dialog">
      <div
        className="theme-preview"
        style={{
          '--preview-title-start': preview.colors.titleBarActiveStart,
          '--preview-title-end': preview.colors.titleBarActiveEnd,
          '--preview-taskbar': preview.colors.taskbar
        }}
        aria-hidden="true"
      >
        <div className="theme-preview-window">
          <div className="theme-preview-title">Windows Media Player</div>
          <div className="theme-preview-body" />
        </div>
        <div className="theme-preview-taskbar"><span>Start</span></div>
      </div>
      <div className="field-row-stacked dialog-field">
        <label htmlFor="theme-select">Theme:</label>
        <select id="theme-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>{theme.fileName}</option>
          ))}
        </select>
      </div>
      <DialogButtons>
        <button type="button" onClick={() => { apply(); onClose(); }}>OK</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={apply} disabled={selected === currentThemeId}>Apply</button>
      </DialogButtons>
    </Dialog>
  );
};

export default ThemesDialog;
