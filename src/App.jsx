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
import RecycleBinDialog from './dialogs/RecycleBinDialog';
import NotesLayer, { noteSize } from './os/NotesLayer';
import useStickyNotes from './os/useStickyNotes';
import { AssistantProvider, useAssistant } from './assistant/AssistantProvider';
import Assistant from './assistant/Assistant';
import useNoteCompanion from './assistant/useNoteCompanion';
import { shouldDock } from './assistant/placement';
import { NOTE_COLORS } from './os/stickyNotes';
import { useForceMaximized, useIsMobile } from './hooks/useMediaQuery';
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
    'Right-click (or long-press) the desktop for more options, like New Sticky Note.'
  ]
};

const DESKTOP_MENU = [
  { label: 'New Sticky Note', action: 'new-note', bold: true },
  { separator: true },
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

const NOTE_COMMANDS = ['notes', 'sticky', 'stikynot', 'stikynot.exe', 'stickynotes'];
const DISKY_COMMANDS = ['disky', 'disky.exe', 'clippy', 'help me'];
const colorLabel = (c) => c[0].toUpperCase() + c.slice(1);

// Right-click / long-press menu on a sticky note's title bar
const noteMenu = (note) => [
  ...NOTE_COLORS.map((color) => ({ label: `${note.color === color ? '✓ ' : '\u2003'}${colorLabel(color)}`, action: `note-color:${color}` })),
  { separator: true },
  { label: note.collapsed ? 'Expand' : 'Collapse', action: 'note-collapse' },
  { label: 'Delete', action: 'note-delete' }
];

// Spotify playlist/album links or URIs typed into Run… (Spotify provider only)
const parseSpotifyLink = (text) => {
  const match = text.match(/(playlist|album)[/:]([A-Za-z0-9]{22})/);
  return match ? { type: match[1], id: match[2], uri: `spotify:${match[1]}:${match[2]}` } : null;
};

function Shell() {
  const music = useMusic();
  const assistant = useAssistant();
  const { switchProvider } = useService();
  const { status, isAuthenticated, authError, clearAuthError, playlists, mode, provider } = music;
  const forceMaximized = useForceMaximized();
  const isMobile = useIsMobile();
  const stickies = useStickyNotes();
  const wm = useWindowManager();
  const [layerEl, setLayerEl] = useState(null);
  const desktopSize = useElementSize(layerEl);

  const [booted, setBooted] = useState(() => {
    try { return sessionStorage.getItem(BOOTED_KEY) === '1'; } catch { return false; }
  });
  const [dialog, setDialog] = useState(null); // { type, props }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, items, target }
  const startupHandledRef = useRef(false);
  const [startupDone, setStartupDone] = useState(false); // after boot: player opened or sign-in shown

  const closeDialog = useCallback(() => setDialog(null), []);
  const showMessage = useCallback((message, title, type) => setDialog({ type: 'message', props: { message, title, type } }), []);

  const openApp = useCallback((appId, request) => {
    // The measured window layer already excludes the taskbar
    wm.open(appId, { request, viewport: desktopSize, taskbarHeight: 0 });
    if (appId === 'media-player') assistant.notify('player-opened');
  }, [wm, desktopSize, assistant]);

  const onBootComplete = useCallback(() => {
    try { sessionStorage.setItem(BOOTED_KEY, '1'); } catch { /* storage blocked */ }
    setBooted(true);
  }, []);

  // After boot: open the player when signed in, otherwise show the sign-in prompt
  useEffect(() => {
    if (!booted || status === 'checking' || startupHandledRef.current) return;
    startupHandledRef.current = true;
    setStartupDone(true);
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

  // New sticky note at a screen point (from the desktop menu), or near the middle of the desktop
  const createNote = useCallback((clientX, clientY) => {
    const size = noteSize(isMobile);
    const rect = layerEl?.getBoundingClientRect() || { left: 0, top: 0 };
    const x = clientX !== undefined ? clientX - rect.left - 8 : desktopSize.width / 2 - size.width / 2 + (stickies.notes.length % 6) * 18;
    const y = clientY !== undefined ? clientY - rect.top - 8 : desktopSize.height / 3 - size.height / 2 + (stickies.notes.length % 6) * 18;
    const id = stickies.create({
      x: Math.min(Math.max(0, x), Math.max(0, desktopSize.width - size.width)),
      y: Math.min(Math.max(0, y), Math.max(0, desktopSize.height - size.height))
    });
    if (!id) showMessage('You have a lot of sticky notes already. Delete a few to make room.', 'Sticky Notes', 'warning');
    else assistant.notify('note-created');
  }, [desktopSize, isMobile, layerEl, showMessage, stickies, assistant]);

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
    if (DISKY_COMMANDS.includes(command)) {
      if (assistant.hidden) assistant.show();
      else assistant.openMenu();
      return;
    }
    if (command === 'hello' || command === 'hi') {
      if (assistant.hidden) assistant.show();
      assistant.notify('hello', { prompted: true });
      return;
    }
    if (NOTE_COMMANDS.includes(command)) {
      createNote();
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
    assistant.notify('run-unknown');
  }, [openApp, playlists, provider, showMessage, createNote, assistant]);

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
      case 'show-disky':
        if (assistant.hidden) assistant.show();
        else assistant.openMenu();
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
        setDialog({ type: 'recycle-bin' });
        break;
      case 'new-note':
        // `data` carries the click point when opened from the desktop menu
        createNote(data?.x, data?.y);
        break;
      case 'properties':
        setDialog({ type: 'display', props: { initialTab: 'background' } });
        break;
      default:
        break;
    }
  }, [openApp, showMessage, signOut, music, createNote, assistant]);

  // Disky waits while any dialog or menu is open, greets first-time visitors after boot,
  // and chimes in when the music server can't be reached
  const { setBlocked, notify } = assistant;
  useEffect(() => {
    setBlocked(!startupDone || Boolean(dialog) || Boolean(contextMenu));
  }, [startupDone, dialog, contextMenu, setBlocked]);

  useEffect(() => {
    if (booted) notify('first-visit');
  }, [booted, notify]);

  useEffect(() => {
    if (/can't reach/i.test(music.statusMessage || '')) notify('server-unreachable');
  }, [music.statusMessage, notify]);

  // Disky reads sticky notes as you write them, and can recycle a finished checklist
  useNoteCompanion(stickies.notes, assistant);
  const { registerHandler } = assistant;
  const removeNote = stickies.remove;
  useEffect(() => registerHandler('recycle-note', (id) => removeNote(id)), [registerHandler, removeNote]);

  // Dock Disky in the tray on phones or when any open window covers his corner, so he never sits on controls
  const assistantDocked = shouldDock({ windows: wm.windows, desktop: desktopSize, isMobile, forceMaximized });

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

  const openNoteMenu = useCallback((x, y, note) => {
    setContextMenu({ x, y, items: noteMenu(note), target: { kind: 'note', id: note.id, collapsed: note.collapsed } });
  }, []);

  const onContextAction = (action) => {
    const target = contextMenu?.target;
    if (target?.kind === 'note') {
      if (action.startsWith('note-color:')) stickies.update(target.id, { color: action.split(':')[1] });
      else if (action === 'note-collapse') stickies.update(target.id, { collapsed: !target.collapsed });
      else if (action === 'note-delete') stickies.remove(target.id);
      return;
    }
    if (action === 'new-note') handleAction('new-note', { x: contextMenu.x, y: contextMenu.y });
    else if (action === 'open-icon' && target) handleAction(target.action, target.data);
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
      <Desktop
        onOpenItem={(item) => handleAction(item.action, item.data)}
        onContextMenu={openIconMenu}
        notes={(
          <NotesLayer
            notes={stickies.notes}
            isMobile={isMobile}
            bounds={desktopSize}
            focusId={stickies.focusId}
            onFocused={stickies.clearFocus}
            onUpdate={stickies.update}
            onFront={stickies.front}
            onDelete={stickies.remove}
            onMenu={openNoteMenu}
          />
        )}
      >
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
        assistantDocked={assistantDocked}
      />

      <Assistant docked={assistantDocked} />

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
      {dialog?.type === 'recycle-bin' && (
        <RecycleBinDialog trash={stickies.trash} onRestore={stickies.restore} onEmpty={stickies.empty} onClose={closeDialog} />
      )}
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
          <AssistantProvider>
            <Shell />
          </AssistantProvider>
        </MusicProvider>
      </Suspense>
    </ThemeProvider>
  );
}
