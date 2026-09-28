import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { SpotifyProvider, useSpotify } from './spotify/SpotifyContext';
import LoadingScreen from './os/LoadingScreen';
import Desktop from './os/Desktop';
import Taskbar from './os/Taskbar';
import Window from './os/Window';
import ContextMenu from './os/ContextMenu';
import useWindowManager from './os/useWindowManager';
import { APP_REGISTRY, RUN_COMMANDS } from './os/appRegistry';
import RunDialog from './dialogs/RunDialog';
import ShutdownDialog from './dialogs/ShutdownDialog';
import MessageDialog from './dialogs/MessageDialog';
import ThemesDialog from './dialogs/ThemesDialog';
import LoginDialog from './dialogs/LoginDialog';
import { useForceMaximized } from './hooks/useMediaQuery';
import useElementSize from './hooks/useElementSize';

const BOOTED_KEY = 'winampify_booted';

const AUTH_ERRORS = {
  state_mismatch: 'Spotify sign-in was interrupted. Please try again.',
  invalid_token: 'Spotify didn\'t accept the sign-in. Please try again.',
  server_error: 'The Winampify server couldn\'t reach Spotify. Please try again.',
  access_denied: 'Spotify sign-in was cancelled.'
};

const HELP_MESSAGE = {
  intro: 'Winampify is a Windows 98-style Spotify player.',
  bullets: [
    'Open Media Player from the desktop or Start → Programs.',
    'Browse playlists, liked songs and albums in the Media Library.',
    'Click the progress bar to seek; drag it to scrub.',
    'On phones, Winampify is a remote: pick a device under Devices and music plays there.',
    'Right-click (or long-press) the desktop for more options.'
  ]
};

const DESKTOP_MENU = [
  { label: 'Arrange Icons', disabled: true },
  { label: 'Refresh', action: 'refresh' },
  { separator: true },
  { label: 'Themes…', action: 'themes' },
  { label: 'Properties', action: 'properties' }
];

const ICON_MENU = [
  { label: 'Open', action: 'open-icon', bold: true },
  { separator: true },
  { label: 'Properties', action: 'icon-properties' }
];

// Spotify playlist/album links or URIs typed into Run…
const parseSpotifyLink = (text) => {
  const match = text.match(/(playlist|album)[/:]([A-Za-z0-9]{22})/);
  return match ? { type: match[1], id: match[2], uri: `spotify:${match[1]}:${match[2]}` } : null;
};

function Shell() {
  const spotify = useSpotify();
  const { status, isAuthenticated, authError, clearAuthError, playlists, mode } = spotify;
  const forceMaximized = useForceMaximized();
  const wm = useWindowManager();
  const [layerEl, setLayerEl] = useState(null);
  const desktopSize = useElementSize(layerEl);

  const [booted, setBooted] = useState(() => {
    try { return sessionStorage.getItem(BOOTED_KEY) === '1'; } catch { return false; }
  });
  const [dialog, setDialog] = useState(null); // { type, props }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, items, target }
  const startupHandledRef = useRef(false);

  const closeDialog = useCallback(() => setDialog(null), []);
  const showMessage = useCallback((message, title, type) => setDialog({ type: 'message', props: { message, title, type } }), []);

  const openApp = useCallback((appId, request) => {
    // The measured window layer already excludes the taskbar
    wm.open(appId, { request, viewport: desktopSize, taskbarHeight: 0 });
  }, [wm, desktopSize]);

  const onBootComplete = useCallback(() => {
    try { sessionStorage.setItem(BOOTED_KEY, '1'); } catch { /* storage blocked */ }
    setBooted(true);
  }, []);

  // After boot: open the player when signed in, otherwise show the sign-in prompt
  useEffect(() => {
    if (!booted || status === 'checking' || startupHandledRef.current) return;
    startupHandledRef.current = true;
    if (isAuthenticated) openApp('media-player');
    else setDialog({ type: 'login' });
  }, [booted, status, isAuthenticated, openApp]);

  useEffect(() => {
    if (authError && booted) {
      showMessage(AUTH_ERRORS[authError] || `Sign-in failed (${authError}).`, 'Spotify', 'warning');
      clearAuthError();
    }
  }, [authError, booted, clearAuthError, showMessage]);

  const signOut = useCallback(() => {
    spotify.logout();
    wm.closeAll();
    setDialog({ type: 'login' });
  }, [spotify, wm]);

  const runCommand = useCallback((raw) => {
    const command = raw.trim().toLowerCase();
    if (RUN_COMMANDS[command]) {
      openApp(RUN_COMMANDS[command]);
      return;
    }
    if (['themes', 'control', 'desk.cpl'].includes(command)) {
      setDialog({ type: 'themes' });
      return;
    }
    const link = parseSpotifyLink(raw);
    if (link) {
      const known = link.type === 'playlist' && playlists.find((pl) => pl.id === link.id);
      const name = known?.name || (link.type === 'album' ? 'Album' : 'Playlist');
      openApp('media-player', { type: 'source', source: { ...link, name, images: known?.images } });
      return;
    }
    showMessage(`Cannot find '${raw}'. Make sure you typed the name correctly, and then try again.`, raw, 'error');
  }, [openApp, playlists, showMessage]);

  const handleAction = useCallback((action, data) => {
    switch (action) {
      case 'open-app':
        openApp(data);
        break;
      case 'open-view':
        openApp('media-player', { type: 'view', view: data });
        break;
      case 'open-source':
        openApp('media-player', { type: 'source', source: data });
        break;
      case 'themes':
        setDialog({ type: 'themes' });
        break;
      case 'run':
        setDialog({ type: 'run' });
        break;
      case 'shutdown':
        setDialog({ type: 'shutdown' });
        break;
      case 'help':
        showMessage(HELP_MESSAGE, 'Winampify Help');
        break;
      case 'login':
        spotify.login();
        break;
      case 'logoff':
        signOut();
        break;
      case 'recycle-bin':
        showMessage('The Recycle Bin is empty.', 'Recycle Bin');
        break;
      case 'properties':
        showMessage({
          intro: 'Winampify 98',
          bullets: [
            `Playback: ${mode === 'sdk' ? 'in this browser (Web Playback SDK)' : 'remote control (Spotify Connect)'}`,
            `Signed in: ${isAuthenticated ? spotify.user?.display_name || 'yes' : 'no'}`,
            `Screen: ${Math.round(desktopSize.width)} × ${Math.round(desktopSize.height)}`
          ]
        }, 'Display Properties');
        break;
      default:
        break;
    }
  }, [openApp, showMessage, signOut, spotify, mode, isAuthenticated, desktopSize]);

  const openIconMenu = useCallback((x, y, target) => {
    setContextMenu({ x, y, items: target ? ICON_MENU : DESKTOP_MENU, target });
  }, []);

  const onContextAction = (action) => {
    const target = contextMenu?.target;
    if (action === 'open-icon' && target) handleAction(target.action, target.data);
    else if (action === 'icon-properties' && target) showMessage({ intro: target.label, bullets: ['Type: Shortcut', 'Target: Windows Media Player'] }, `${target.label} Properties`);
    else handleAction(action);
  };

  const closeWindow = useCallback((id) => {
    const win = wm.windows.find((w) => w.id === id);
    // Closing the player stops in-browser audio, like WMP; remote playback keeps going
    if (win?.appId === 'media-player') spotify.controls.pauseIfPlaying();
    wm.close(id);
  }, [wm, spotify.controls]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  if (!booted) return <LoadingScreen onComplete={onBootComplete} />;

  return (
    <div className="app-reveal">
      <Desktop onOpenItem={(item) => handleAction(item.action, item.data)} onContextMenu={openIconMenu}>
        <div className="window-layer" ref={setLayerEl}>
          {wm.windows.map((win) => {
            const App = APP_REGISTRY[win.appId].component;
            return (
              <Window
                key={win.id}
                {...win}
                isActive={wm.activeId === win.id}
                forceMaximized={forceMaximized}
                desktopSize={desktopSize}
                onFocus={wm.focus}
                onMinimize={wm.minimize}
                onToggleMaximize={wm.toggleMaximize}
                onClose={closeWindow}
                onMove={wm.move}
              >
                <App request={win.request} onClose={() => closeWindow(win.id)} />
              </Window>
            );
          })}
        </div>
      </Desktop>

      <Taskbar
        windows={wm.windows}
        activeId={wm.activeId}
        onToggleWindow={wm.toggleFromTaskbar}
        onMenuAction={handleAction}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onAction={onContextAction}
          onClose={closeContextMenu}
        />
      )}

      {dialog?.type === 'run' && <RunDialog onClose={closeDialog} onRun={runCommand} />}
      {dialog?.type === 'themes' && <ThemesDialog onClose={closeDialog} />}
      {dialog?.type === 'message' && <MessageDialog {...dialog.props} onClose={closeDialog} />}
      {dialog?.type === 'shutdown' && (
        <ShutdownDialog
          onClose={closeDialog}
          isAuthenticated={isAuthenticated}
          onChoose={(choice) => (choice === 'restart' ? window.location.reload() : signOut())}
        />
      )}
      {dialog?.type === 'login' && !isAuthenticated && (
        <LoginDialog onLogin={spotify.login} onClose={closeDialog} remoteMode={mode === 'connect'} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SpotifyProvider>
        <Shell />
      </SpotifyProvider>
    </ThemeProvider>
  );
}
