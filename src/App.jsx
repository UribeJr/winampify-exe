import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { MusicProvider, useMusic, useService } from './music/MusicContext';
import NoServiceBackend from './music/NoServiceBackend';
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
import DisplayProperties from './dialogs/DisplayProperties';
import LoginDialog from './dialogs/LoginDialog';
import { useForceMaximized } from './hooks/useMediaQuery';
import useElementSize from './hooks/useElementSize';

const BOOTED_KEY = 'winampify_booted';

// Picked on the sign-in screen; lazy so the unused backend never loads
const BACKENDS = {
  navidrome: lazy(() => import('./music/NavidromeBackend')),
  spotify: lazy(() => import('./spotify/SpotifyBackend'))
};

const AUTH_ERRORS = {
  state_mismatch: 'Spotify sign-in was interrupted. Please try again.',
  invalid_token: 'Spotify didn\'t accept the sign-in. Please try again.',
  server_error: 'The Winampify server couldn\'t reach Spotify. Please try again.',
  access_denied: 'Spotify sign-in was cancelled.'
};

const HELP_MESSAGE = {
  intro: 'Winampify is a Windows 98-style music player for your Navidrome or Spotify library.',
  bullets: [
    'Open Media Player from the desktop or Start → Programs.',
    'Browse playlists, liked songs and albums in the Media Library.',
    'Click the progress bar to seek; drag it to scrub.',
    'Search your library from the toolbar (or the top of the Library on phones).',
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

// Spotify playlist/album links or URIs typed into Run… (Spotify provider only)
const parseSpotifyLink = (text) => {
  const match = text.match(/(playlist|album)[/:]([A-Za-z0-9]{22})/);
  return match ? { type: match[1], id: match[2], uri: `spotify:${match[1]}:${match[2]}` } : null;
};

function Shell() {
  const music = useMusic();
  const { switchProvider } = useService();
  const { status, isAuthenticated, authError, clearAuthError, playlists, mode, provider } = music;
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

  // Connecting from the sign-in prompt: close it and open the player
  useEffect(() => {
    if (isAuthenticated && dialog?.type === 'login') {
      setDialog(null);
      openApp('media-player');
    }
  }, [isAuthenticated, dialog, openApp]);

  useEffect(() => {
    if (authError && booted) {
      showMessage(AUTH_ERRORS[authError] || `Sign-in failed (${authError}).`, 'Spotify', 'warning');
      clearAuthError();
    }
  }, [authError, booted, clearAuthError, showMessage]);

  // Log Off / Shut Down: sign out, close windows and go back to "Select your music service"
  const signOut = useCallback(() => {
    music.logout();
    switchProvider();
    wm.closeAll();
    setDialog({ type: 'login' });
  }, [music, switchProvider, wm]);

  const runCommand = useCallback((raw) => {
    const command = raw.trim().toLowerCase();
    if (RUN_COMMANDS[command]) {
      openApp(RUN_COMMANDS[command]);
      return;
    }
    if (['desk.cpl', 'control desk', 'control', 'display'].includes(command)) {
      setDialog({ type: 'display', props: { initialTab: 'background' } });
      return;
    }
    if (command === 'themes') {
      setDialog({ type: 'display', props: { initialTab: 'appearance' } });
      return;
    }
    const link = provider === 'spotify' ? parseSpotifyLink(raw) : null;
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
        setDialog({ type: 'display', props: { initialTab: 'appearance' } });
        break;
      case 'wallpaper':
        setDialog({ type: 'display', props: { initialTab: 'background' } });
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
        if (music.provider) music.login();
        else setDialog({ type: 'login' });
        break;
      case 'logoff':
      case 'switch-service':
        signOut();
        break;
      case 'recycle-bin':
        showMessage('The Recycle Bin is empty.', 'Recycle Bin');
        break;
      case 'properties':
        setDialog({ type: 'display', props: { initialTab: 'background' } });
        break;
      default:
        break;
    }
  }, [openApp, showMessage, signOut, music]);

  // Read-only facts for Display Properties → Settings
  const displayInfo = [
    ['Music service', music.provider ? `${music.providerName}${provider === 'navidrome' ? ` (${music.serverLabel})` : ''}` : 'None selected'],
    ['Playback', music.provider ? { local: 'This browser (HTML5 audio)', sdk: 'This browser (Spotify Web Playback SDK)', connect: 'Remote control (Spotify Connect)' }[mode] : '—'],
    ['Signed in', isAuthenticated ? music.user?.name || 'Yes' : 'No'],
    ['Desktop area', `${Math.round(desktopSize.width)} × ${Math.round(desktopSize.height)} pixels`]
  ];

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
    if (win?.appId === 'media-player') music.controls.pauseIfPlaying();
    wm.close(id);
  }, [wm, music.controls]);

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
      {dialog?.type === 'display' && (
        <DisplayProperties
          {...dialog.props}
          info={displayInfo}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'message' && <MessageDialog {...dialog.props} onClose={closeDialog} />}
      {dialog?.type === 'shutdown' && (
        <ShutdownDialog
          onClose={closeDialog}
          isAuthenticated={isAuthenticated}
          onChoose={(choice) => (choice === 'restart' ? window.location.reload() : signOut())}
        />
      )}
      {dialog?.type === 'login' && !isAuthenticated && (
        <LoginDialog music={music} onClose={closeDialog} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <MusicProvider backends={BACKENDS} fallback={NoServiceBackend}>
          <Shell />
        </MusicProvider>
      </Suspense>
    </ThemeProvider>
  );
}
