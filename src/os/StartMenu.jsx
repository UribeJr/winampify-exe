import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMusic } from '../music/MusicContext';
import { playlistSource } from '../music/models';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useMediaQuery';

const HOVER_CLOSE_DELAY_MS = 300;
const MAX_PLAYLIST_ITEMS = 12;

/**
 * Start menu. Submenus open on hover for mouse users and on tap/click for everyone
 * (the portfolio's hover-only submenus didn't work on touch screens).
 * The XP skin on desktop gets XP's two-column layout with the same items and actions.
 */
const StartMenu = ({ isOpen, onClose, onMenuAction }) => {
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);
  const pointerTypeRef = useRef('mouse');
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const { isAuthenticated, playlists, user, providerName, capabilities } = useMusic();
  const [query, setQuery] = useState('');
  const { skin } = useTheme();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isOpen) {
      setOpenSubmenu(null);
      setQuery('');
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
      { id: 'wmp', label: 'Windows Media Player', icon: 'media', action: 'open-app', data: 'media-player' },
      { id: 'note', label: 'Sticky Note', icon: 'note', action: 'new-note' }
    ],
    playlists: isAuthenticated
      ? [
          { id: 'liked', label: 'Liked Songs', action: 'open-source', data: { type: 'liked' } },
          ...playlists.slice(0, MAX_PLAYLIST_ITEMS).map((pl) => ({
            id: pl.id,
            label: pl.name,
            action: 'open-source',
            data: playlistSource(pl)
          })),
          ...(playlists.length === 0 ? [{ id: 'empty', label: '(No playlists)', disabled: true }] : [])
        ]
      : [{ id: 'signin', label: `Connect to ${providerName} to see playlists…`, action: 'open-app', data: 'media-player' }],
    help: [
      { id: 'help', label: 'Winampify Help', icon: 'help', action: 'help' },
      { id: 'disky', label: 'Show Disky', icon: 'disky', action: 'show-disky' }
    ],
    settings: [
      { id: 'wallpaper', label: 'Wallpaper…', action: 'wallpaper' },
      { id: 'themes', label: 'Themes…', action: 'themes' },
      { id: 'service', label: 'Music Service…', action: 'switch-service' }
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
        onPointerDown={(e) => { pointerTypeRef.current = e.pointerType; }}
        // Mouse users already opened it on hover, so a click must not toggle it shut; taps toggle
        onClick={() => setOpenSubmenu((current) => (current === id && pointerTypeRef.current !== 'mouse' ? null : id))}
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

  const accountItem = isAuthenticated
    ? { icon: 'logoff', label: `Log Off ${user?.name || ''}…`.replace(' …', '…'), action: 'logoff' }
    : { icon: 'logoff', label: providerName === 'Spotify' ? 'Sign In…' : `Connect to ${providerName}…`, action: 'login' };

  // XP: big two-line items on the left, folders and settings on the right
  const XpItem = ({ icon, label, detail, action, data }) => (
    <button type="button" className="start-menu-item start-menu-row xp-start-item" onClick={() => select(action, data)}>
      <span className={`start-menu-icon icon-${icon}`} aria-hidden="true" />
      <span className="start-menu-text">
        <b>{label}</b>
        {detail && <small>{detail}</small>}
      </span>
    </button>
  );

  // Windows 7: white programs column with a search box, dark glass places column, Shut down
  if (skin === '7' && !isMobile) {
    const canSearch = isAuthenticated && capabilities?.search;
    const powerOpen = openSubmenu === 'power';
    return (
      <div className="wmp-start-menu s7-start-menu" ref={menuRef} role="menu">
        <div className="s7-start-left">
          <div className="s7-start-pinned">
            {XpItem({ icon: 'media', label: 'Media Player', detail: providerName, action: 'open-app', data: 'media-player' })}
            {XpItem({ icon: 'heart', label: 'Liked Songs', detail: 'Your favorites', action: 'open-source', data: { type: 'liked' } })}
            {XpItem({ icon: 'note', label: 'Sticky Note', detail: 'Jot something down', action: 'new-note' })}
          </div>
          <div className="xp-start-spacer" />
          <div className="start-menu-separator" />
          <div className="xp-start-all s7-start-all">
            {SubmenuItem({ id: 'programs', icon: 'programs', label: 'All Programs' })}
          </div>
          {canSearch && (
            <form
              className="s7-start-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) select('search-music', query.trim());
              }}
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search programs and music"
                aria-label="Search programs and music"
                autoFocus
              />
            </form>
          )}
        </div>
        <div className="s7-start-right">
          <span className="s7-start-avatar icon-disky" aria-hidden="true" />
          {Item({ icon: 'media', label: 'Music', action: 'open-app', data: 'media-player' })}
          {SubmenuItem({ id: 'playlists', icon: 'documents', label: 'My Playlists' })}
          <div className="start-menu-separator" />
          {Item({ icon: 'themes', label: 'Display Properties', action: 'themes' })}
          {Item({ icon: 'settings', label: 'Wallpaper', action: 'wallpaper' })}
          {Item({ icon: 'cd', label: 'Music Service', action: 'switch-service' })}
          <div className="start-menu-separator" />
          {SubmenuItem({ id: 'help', icon: 'help', label: 'Help and Support' })}
          {Item({ icon: 'run', label: 'Run…', action: 'run' })}
          <div className="xp-start-spacer" />
          <div className="s7-power">
            <button type="button" className="s7-shutdown" onClick={() => select('shutdown')}>Shut down</button>
            <button
              type="button"
              className="s7-shutdown-more"
              aria-label="More shut down options"
              aria-haspopup="menu"
              aria-expanded={powerOpen}
              onClick={() => setOpenSubmenu(powerOpen ? null : 'power')}
            >
              ▸
            </button>
            {powerOpen && (
              <div className="start-menu-submenu s7-power-menu" role="menu">
                <button type="button" className="start-menu-item start-menu-row" onClick={() => select(accountItem.action)}>
                  <span className="start-menu-icon icon-logoff" aria-hidden="true" />
                  <span className="start-menu-text">{accountItem.label}</span>
                </button>
                <button type="button" className="start-menu-item start-menu-row" onClick={() => select('switch-service')}>
                  <span className="start-menu-icon icon-cd" aria-hidden="true" />
                  <span className="start-menu-text">Switch Music Service…</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (skin === 'xp' && !isMobile) {
    return (
      <div className="wmp-start-menu xp-start-menu" ref={menuRef} role="menu">
        <div className="xp-start-head">
          <span className="xp-start-avatar icon-disky" aria-hidden="true" />
          <b>Winampify</b>
        </div>
        <div className="xp-start-cols">
          <div className="xp-start-left">
            {XpItem({ icon: 'media', label: 'Media Player', detail: providerName, action: 'open-app', data: 'media-player' })}
            {XpItem({ icon: 'heart', label: 'Liked Songs', detail: 'Your favorites', action: 'open-source', data: { type: 'liked' } })}
            {XpItem({ icon: 'note', label: 'Sticky Note', detail: 'Jot something down', action: 'new-note' })}
            <div className="xp-start-spacer" />
            <div className="start-menu-separator" />
            <div className="xp-start-all">
              {SubmenuItem({ id: 'programs', icon: 'programs', label: 'All Programs' })}
            </div>
          </div>
          <div className="xp-start-right">
            {SubmenuItem({ id: 'playlists', icon: 'documents', label: 'My Playlists' })}
            {Item({ icon: 'themes', label: 'Display Properties', action: 'themes' })}
            {Item({ icon: 'settings', label: 'Wallpaper', action: 'wallpaper' })}
            {Item({ icon: 'cd', label: 'Music Service', action: 'switch-service' })}
            <div className="start-menu-separator" />
            {SubmenuItem({ id: 'help', icon: 'help', label: 'Help and Support' })}
            {Item({ icon: 'run', label: 'Run…', action: 'run' })}
          </div>
        </div>
        <div className="xp-start-foot">
          <button type="button" onClick={() => select(accountItem.action)}>
            <span className={`start-menu-icon icon-${accountItem.icon}`} aria-hidden="true" />
            {accountItem.label}
          </button>
          <button type="button" onClick={() => select('shutdown')}>
            <span className="start-menu-icon icon-shutdown" aria-hidden="true" />
            Turn Off…
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wmp-start-menu" ref={menuRef} role="menu">
      <div className="start-menu-side">
        <span className="start-menu-brand">
          <b>Winampify</b><span className="start-menu-brand-version">{skin === '98' ? '98' : skin}</span>
        </span>
      </div>
      <div className="start-menu-list">
        {SubmenuItem({ id: 'programs', icon: 'programs', label: 'Programs' })}
        {SubmenuItem({ id: 'playlists', icon: 'documents', label: 'Playlists' })}
        {SubmenuItem({ id: 'settings', icon: 'settings', label: 'Settings' })}
        {SubmenuItem({ id: 'help', icon: 'help', label: 'Help' })}
        {Item({ icon: 'run', label: 'Run…', action: 'run' })}
        <div className="start-menu-separator" />
        {Item(accountItem)}
        {Item({ icon: 'shutdown', label: 'Shut Down…', action: 'shutdown' })}
      </div>
    </div>
  );
};

export default StartMenu;
