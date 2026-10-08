import React, { useState, useRef, useMemo, useEffect } from 'react';
import Dialog, { DialogButtons } from './Dialog';
import { useTheme } from '../contexts/ThemeContext';
import { useAssistant } from '../assistant/AssistantProvider';
import { SKINS, getSchemesForSkin, resolveScheme, isStyledSkin, skinWallpaper } from '../data/skins';
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
 * Appearance (Windows 98 / XP / 7 look, color scheme, 7's transparency) and Settings (read-only info). OK / Cancel / Apply.
 */
const DisplayProperties = ({ initialTab = 'background', info = [], onClose }) => {
  const {
    skin, schemeId, schemeFor, transparency, setAppearance, wallpaper, customWallpaper, setWallpaper, setCustomWallpaper, clearCustomWallpaper
  } = useTheme();
  const fileRef = useRef(null);
  const { notify } = useAssistant();

  // Disky's Browse… and XP-look tips (he waits until this dialog closes; each is said once)
  useEffect(() => {
    notify('display-opened');
    if (!isStyledSkin(skin)) notify('display-xp-hint');
  }, [notify]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState(initialTab);
  const [draftWallpaper, setDraftWallpaper] = useState(wallpaper);
  const [draftSkin, setDraftSkin] = useState(skin);
  const [draftScheme, setDraftScheme] = useState(schemeId);
  const [draftGlass, setDraftGlass] = useState(transparency);
  const [useSkinWallpaper, setUseSkinWallpaper] = useState(false);
  const [applying, setApplying] = useState(false);
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
    || draftSkin !== skin
    || draftScheme !== schemeId
    || draftGlass !== transparency
    || useSkinWallpaper;

  const apply = async () => {
    if (pendingCustom) {
      const remembered = setCustomWallpaper(pendingCustom);
      setPendingCustom(null);
      if (!remembered) {
        setNotice('That picture is too large to remember. It will show until you reload the page — try a smaller image.');
        return false;
      }
    }
    const nextWallpaper = useSkinWallpaper ? skinWallpaperChoice : draftWallpaper;
    setWallpaper(nextWallpaper.id, nextWallpaper.mode);
    if (useSkinWallpaper) {
      setDraftWallpaper(skinWallpaperChoice);
      setUseSkinWallpaper(false);
    }
    if (draftSkin !== skin || draftScheme !== schemeId || draftGlass !== transparency) {
      setApplying(true);
      const ok = await setAppearance(draftSkin, draftScheme, { transparency: draftGlass });
      setApplying(false);
      if (!ok) {
        setNotice(`Winampify couldn't load the ${SKINS.find((x) => x.id === draftSkin)?.name || 'new'} look. Check your connection and try again.`);
        return false;
      }
    }
    setNotice(null);
    return true;
  };

  const chooseSkin = (next) => {
    setDraftSkin(next);
    setDraftScheme(resolveScheme(next, schemeFor(next)));
    setUseSkinWallpaper(false);
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

  const schemes = getSchemesForSkin(draftSkin);
  const scheme = schemes.find((x) => x.id === draftScheme) || schemes[0];
  const previewStyle = scheme.preview
    ? { '--preview-title-start': scheme.preview.title, '--preview-title-end': scheme.preview.title, '--preview-taskbar': scheme.preview.taskbar }
    : { '--preview-title-start': scheme.colors.titleBarActiveStart, '--preview-title-end': scheme.colors.titleBarActiveEnd, '--preview-taskbar': scheme.colors.taskbar };
  // The original wallpaper that goes with the chosen skin (offered, never forced)
  const skinWallpaperId = skinWallpaper(draftSkin);
  const skinWallpaperChoice = skinWallpaperId ? { id: skinWallpaperId, mode: 'stretch' } : null;
  const offerSkinWallpaper = skinWallpaperChoice && wallpaper.id !== skinWallpaperId && draftWallpaper.id !== skinWallpaperId;

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
                data-preview-skin={draftSkin}
                data-preview-glass={draftSkin === '7' && draftGlass ? 'on' : undefined}
                style={{ ...previewStyle, ...previewBackground(useSkinWallpaper ? skinWallpaperChoice : draftWallpaper, customUrl) }}
                aria-hidden="true"
              >
                <div className="theme-preview-window">
                  <div className="theme-preview-title">Windows Media Player</div>
                  <div className="theme-preview-body" />
                </div>
                <div className="theme-preview-taskbar"><span>Start</span></div>
              </div>
              <div className="field-row-stacked dialog-field">
                <label htmlFor="skin-select">Windows and buttons:</label>
                <select id="skin-select" value={draftSkin} onChange={(e) => chooseSkin(e.target.value)}>
                  {SKINS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field-row-stacked dialog-field">
                <label htmlFor="theme-select">Color scheme:</label>
                <select id="theme-select" value={draftScheme} onChange={(e) => setDraftScheme(e.target.value)}>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>{scheme.fileName || scheme.name}</option>
                  ))}
                </select>
              </div>
              {draftSkin === '7' && (
                <div className="field-row dialog-field">
                  <input id="skin-glass" type="checkbox" checked={draftGlass} onChange={(e) => setDraftGlass(e.target.checked)} />
                  <label htmlFor="skin-glass">Enable transparency</label>
                </div>
              )}
              {offerSkinWallpaper && (
                <div className="field-row dialog-field">
                  <input id="skin-wallpaper" type="checkbox" checked={useSkinWallpaper} onChange={(e) => setUseSkinWallpaper(e.target.checked)} />
                  <label htmlFor="skin-wallpaper">Also use the {getWallpaper(skinWallpaperId).name.replace(/ \(.*\)$/, '')} wallpaper</label>
                </div>
              )}
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
        <button type="button" onClick={async () => { if (await apply()) onClose(); }} disabled={applying}>OK</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={apply} disabled={!dirty || applying}>Apply</button>
      </DialogButtons>
    </Dialog>
  );
};

export default DisplayProperties;
