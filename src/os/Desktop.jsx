import React, { useState, useCallback } from 'react';
import useLongPress from '../hooks/useLongPress';

export const DESKTOP_ICONS = [
  { id: 'media-player', label: 'Media Player', icon: 'media-player', action: 'open-app', data: 'media-player' },
  { id: 'my-music', label: 'My Music', icon: 'directory_closed-4', action: 'open-view', data: 'mediaLibrary' },
  { id: 'liked-songs', label: 'Liked Songs', icon: 'cd-audio', action: 'open-source', data: { type: 'liked' } },
  { id: 'themes', label: 'Themes', icon: 'paint_brush-0', action: 'themes' },
  { id: 'recycle-bin', label: 'Recycle Bin', icon: 'recycle-bin', action: 'recycle-bin' }
];

const DesktopIcon = ({ item, selected, onSelect, onOpen, onContextMenu }) => {
  const longPress = useLongPress(useCallback((x, y) => onContextMenu(x, y, item), [onContextMenu, item]));

  return (
    <button
      type="button"
      className={`desktop-icon ${selected ? 'selected' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
        onOpen(item);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(item.id);
        onContextMenu(e.clientX, e.clientY, item);
      }}
      {...longPress}
    >
      <span className={`desktop-icon-img icon-${item.icon}`} aria-hidden="true" />
      <span className="desktop-icon-text">{item.label}</span>
    </button>
  );
};

/**
 * Desktop surface with icons. Icons open on a single click/tap (like the portfolio);
 * right-click or long-press opens a context menu on the icon or the desktop itself.
 */
const Desktop = ({ onOpenItem, onContextMenu, children }) => {
  const [selectedId, setSelectedId] = useState(null);

  const openDesktopMenu = useCallback((x, y) => onContextMenu(x, y, null), [onContextMenu]);
  const desktopLongPress = useLongPress(openDesktopMenu);

  return (
    <div
      className="wmp-desktop-area"
      onClick={() => setSelectedId(null)}
      onContextMenu={(e) => {
        if (e.target.closest('.os-window')) return;
        e.preventDefault();
        openDesktopMenu(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) desktopLongPress.onPointerDown(e);
      }}
      onPointerMove={desktopLongPress.onPointerMove}
      onPointerUp={desktopLongPress.onPointerUp}
      onPointerCancel={desktopLongPress.onPointerCancel}
    >
      <div className="wmp-desktop-icons">
        {DESKTOP_ICONS.map((item) => (
          <DesktopIcon
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={setSelectedId}
            onOpen={onOpenItem}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
      {children}
    </div>
  );
};

export default Desktop;
