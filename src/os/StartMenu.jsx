import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSpotify } from '../spotify/SpotifyContext';

const HOVER_CLOSE_DELAY_MS = 300;
const MAX_PLAYLIST_ITEMS = 12;

/**
 * Start menu. Submenus open on hover for mouse users and on tap/click for everyone
 * (the portfolio's hover-only submenus didn't work on touch screens).
 */
const StartMenu = ({ isOpen, onClose, onMenuAction }) => {
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const { isAuthenticated, playlists, user } = useSpotify();

  useEffect(() => {
    if (!isOpen) {
      setOpenSubmenu(null);
      return undefined;
    }
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.taskbar-start')) {
        onClose();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      clearTimeout(closeTimerRef.current);
    };
  }, [isOpen, onClose]);

  const select = useCallback((action, data = null) => {
    onMenuAction(action, data);
    onClose();
  }, [onMenuAction, onClose]);

  if (!isOpen) return null;

  const hoverOpen = (id) => (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(closeTimerRef.current);
    setOpenSubmenu(id);
  };
  const hoverClose = (id) => (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenSubmenu((current) => (current === id ? null : current));
    }, HOVER_CLOSE_DELAY_MS);
  };

  const submenus = {
    programs: [
      { id: 'wmp', label: 'Windows Media Player', icon: 'media', action: 'open-app', data: 'media-player' }
    ],
    playlists: isAuthenticated
      ? [
          { id: 'liked', label: 'Liked Songs', action: 'open-source', data: { type: 'liked' } },
          ...playlists.slice(0, MAX_PLAYLIST_ITEMS).map((pl) => ({
            id: pl.id,
            label: pl.name,
            action: 'open-source',
            data: { type: 'playlist', id: pl.id, name: pl.name, uri: pl.uri }
          })),
          ...(playlists.length === 0 ? [{ id: 'empty', label: '(No playlists)', disabled: true }] : [])
        ]
      : [{ id: 'signin', label: 'Sign in to see playlists…', action: 'open-app', data: 'media-player' }],
    settings: [
      { id: 'themes', label: 'Themes…', action: 'themes' }
    ]
  };

  const SubmenuItem = ({ id, icon, label }) => (
    <div
      className={`start-menu-item has-submenu ${openSubmenu === id ? 'open' : ''}`}
      onPointerEnter={hoverOpen(id)}
      onPointerLeave={hoverClose(id)}
    >
      <button
        type="button"
        className="start-menu-row"
        aria-haspopup="menu"
        aria-expanded={openSubmenu === id}
        onClick={() => setOpenSubmenu((current) => (current === id ? null : id))}
      >
        <span className={`start-menu-icon icon-${icon}`} aria-hidden="true" />
        <span className="start-menu-text">{label}</span>
        <span className="start-menu-arrow" aria-hidden="true">▸</span>
      </button>
      {openSubmenu === id && (
        <div className="start-menu-submenu" role="menu">
          {submenus[id].map((item) => (
            <button
              type="button"
              key={item.id}
              className="start-menu-item start-menu-row"
              disabled={item.disabled}
              onClick={() => item.action && select(item.action, item.data)}
            >
              <span className={`start-menu-icon ${item.icon ? `icon-${item.icon}` : 'icon-cd'}`} aria-hidden="true" />
              <span className="start-menu-text">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const Item = ({ icon, label, action, data }) => (
    <button type="button" className="start-menu-item start-menu-row" onClick={() => select(action, data)}>
      <span className={`start-menu-icon icon-${icon}`} aria-hidden="true" />
      <span className="start-menu-text">{label}</span>
    </button>
  );

  return (
    <div className="wmp-start-menu" ref={menuRef} role="menu">
      <div className="start-menu-side">
        <span className="start-menu-brand">
          <b>Winampify</b><span className="start-menu-brand-version">98</span>
        </span>
      </div>
      <div className="start-menu-list">
        {SubmenuItem({ id: 'programs', icon: 'programs', label: 'Programs' })}
        {SubmenuItem({ id: 'playlists', icon: 'documents', label: 'Playlists' })}
        {SubmenuItem({ id: 'settings', icon: 'settings', label: 'Settings' })}
        {Item({ icon: 'help', label: 'Help', action: 'help' })}
        {Item({ icon: 'run', label: 'Run…', action: 'run' })}
        <div className="start-menu-separator" />
        {isAuthenticated
          ? Item({ icon: 'logoff', label: `Log Off ${user?.display_name || ''}…`.replace(' …', '…'), action: 'logoff' })
          : Item({ icon: 'logoff', label: 'Sign In…', action: 'login' })}
        {Item({ icon: 'shutdown', label: 'Shut Down…', action: 'shutdown' })}
      </div>
    </div>
  );
};

export default StartMenu;
