import React, { useState, useRef, useMemo, useEffect } from 'react';
import Dialog, { DialogButtons } from './Dialog';
import { useTheme } from '../contexts/ThemeContext';
import { useAssistant } from '../assistant/AssistantProvider';
import { getThemeList } from '../data/themes';
import { WALLPAPERS, MODES, CUSTOM_WALLPAPER_ID, DEFAULT_WALLPAPER, getWallpaper, wallpaperStyle } from '../data/wallpapers';

const MAX_SIDE_PX = 1920;
const TABS = [
  { id: 'background', label: 'Background' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'settings', label: 'Settings' }
];

// Decode, downscale and re-encode a picked image so it fits comfortably in localStorage
async function imageToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

// The preview screen is ~1/5 scale, so shrink tiles to match
const previewBackground = (selection, customUrl) => {
  const style = wallpaperStyle(selection, customUrl);
  const tileSize = selection.mode === 'tile'
    ? getWallpaper(selection.id)?.previewTile || '20%'
    : style.size === 'auto' ? '20%' : style.size;
  return {
    backgroundColor: 'var(--desktop-teal)',
    backgroundImage: style.image,
    backgroundSize: tileSize,
    backgroundRepeat: style.repeat,
    backgroundPosition: style.position
  };
};

/**
 * Win98-style Display Properties: Background (wallpaper + display mode + Browse…),
 * Appearance (color theme) and Settings (read-only info). OK / Cancel / Apply like the original.
 */
const DisplayProperties = ({ initialTab = 'background', info = [], onClose }) => {
  const {
    currentThemeId, setTheme, wallpaper, customWallpaper, setWallpaper, setCustomWallpaper, clearCustomWallpaper
  } = useTheme();
  const themes = getThemeList();
  const fileRef = useRef(null);
  const { notify } = useAssistant();

  // Disky's Browse… tip (he waits until this dialog closes)
  useEffect(() => { notify('display-opened'); }, [notify]);

  const [tab, setTab] = useState(initialTab);
  const [draftWallpaper, setDraftWallpaper] = useState(wallpaper);
  const [draftTheme, setDraftTheme] = useState(currentThemeId);
  const [pendingCustom, setPendingCustom] = useState(null); // picked via Browse…, not yet applied
  const [loadingImage, setLoadingImage] = useState(false);
  const [notice, setNotice] = useState(null);

  const customUrl = pendingCustom || customWallpaper;
  const items = useMemo(() => [
    ...WALLPAPERS,
    ...(customUrl ? [{ id: CUSTOM_WALLPAPER_ID, name: '(Your picture)', defaultMode: 'stretch' }] : [])
  ], [customUrl]);

  const dirty = pendingCustom
    || draftWallpaper.id !== wallpaper.id
    || draftWallpaper.mode !== wallpaper.mode
    || draftTheme !== currentThemeId;

  const apply = () => {
    if (pendingCustom) {
      const remembered = setCustomWallpaper(pendingCustom);
      setPendingCustom(null);
      if (!remembered) {
        setNotice('That picture is too large to remember. It will show until you reload the page — try a smaller image.');
        return false;
      }
    }
    setWallpaper(draftWallpaper.id, draftWallpaper.mode);
    setTheme(draftTheme);
    return true;
  };

  const pick = (item) => setDraftWallpaper({ id: item.id, mode: item.defaultMode });

  const browse = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoadingImage(true);
    setNotice(null);
    try {
      const dataUrl = await imageToDataUrl(file);
      setPendingCustom(dataUrl);
      setDraftWallpaper({ id: CUSTOM_WALLPAPER_ID, mode: 'stretch' });
    } catch {
      setNotice('Winampify can\'t open that file. Choose a JPEG, PNG, GIF or WebP image.');
    } finally {
      setLoadingImage(false);
    }
  };

  const removeCustom = () => {
    setPendingCustom(null);
    clearCustomWallpaper();
    if (draftWallpaper.id === CUSTOM_WALLPAPER_ID) setDraftWallpaper(DEFAULT_WALLPAPER);
  };

  const preview = themes.find((t) => t.id === draftTheme) || themes[0];

  return (
    <Dialog title="Display Properties" icon="themes" onClose={onClose} className="display-properties">
      <menu role="tablist" className="display-tabs">
        {TABS.map((t) => (
          <li role="tab" key={t.id} aria-selected={tab === t.id}>
            <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); setTab(t.id); }}>{t.label}</a>
          </li>
        ))}
      </menu>
      <div className="window display-panel" role="tabpanel">
        <div className="window-body">
          {tab === 'background' && (
            <div className="display-background">
              <div className="monitor" aria-hidden="true">
                <div className="monitor-screen" style={previewBackground(draftWallpaper, customUrl)} />
                <div className="monitor-stand" />
              </div>
              <div className="display-controls">
                <span id="wallpaper-label">Wallpaper</span>
                <div className="wallpaper-list" role="listbox" aria-labelledby="wallpaper-label">
                  {items.map((item) => (
                    <button
                      type="button"
                      role="option"
                      key={item.id}
                      aria-selected={draftWallpaper.id === item.id}
                      className={`wallpaper-option ${draftWallpaper.id === item.id ? 'selected' : ''}`}
                      onClick={() => pick(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="display-row">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={loadingImage}>
                    {loadingImage ? 'Loading…' : 'Browse…'}
                  </button>
                  {customUrl && <button type="button" onClick={removeCustom}>Remove</button>}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={browse} />
                </div>
                <div className="field-row-stacked">
                  <label htmlFor="wallpaper-mode">Display:</label>
                  <select
                    id="wallpaper-mode"
                    value={draftWallpaper.mode}
                    disabled={draftWallpaper.id === 'teal'}
                    onChange={(e) => setDraftWallpaper((w) => ({ ...w, mode: e.target.value }))}
                  >
                    {Object.entries(MODES).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="display-appearance">
              <div
                className="theme-preview"
                style={{
                  '--preview-title-start': preview.colors.titleBarActiveStart,
                  '--preview-title-end': preview.colors.titleBarActiveEnd,
                  '--preview-taskbar': preview.colors.taskbar,
                  ...previewBackground(draftWallpaper, customUrl)
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
                <label htmlFor="theme-select">Scheme:</label>
                <select id="theme-select" value={draftTheme} onChange={(e) => setDraftTheme(e.target.value)}>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.fileName}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <dl className="display-settings">
              {info.map(([term, detail]) => (
                <React.Fragment key={term}>
                  <dt>{term}</dt>
                  <dd>{detail}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </div>
      </div>
      {notice && <p className="display-notice" role="alert">{notice}</p>}
      <DialogButtons>
        <button type="button" onClick={() => { if (apply()) onClose(); }}>OK</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={apply} disabled={!dirty}>Apply</button>
      </DialogButtons>
    </Dialog>
  );
};

export default DisplayProperties;
