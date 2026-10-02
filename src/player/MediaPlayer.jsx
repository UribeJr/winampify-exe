import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MenuBar from './MenuBar';
import { Toolbar, MobileViewBar } from './Toolbar';
import NowPlayingView from './NowPlayingView';
import LibraryView from './LibraryView';
import PlaylistView from './PlaylistView';
import NowPlayingPane from './NowPlayingPane';
import ControlBar from './ControlBar';
import DevicePicker from './DevicePicker';
import useTrackList from './useTrackList';
import { useLibraryCollections, useArtistDetail, useSearchExtras } from './useLibraryData';
import { LIKED_SOURCE, sourceKey } from './utils';
import { playlistSource, searchSource } from '../music/models';
import { useMusic } from '../music/MusicContext';
import { useIsMobile } from '../hooks/useMediaQuery';

const SEEK_STEP_MS = 10000;

// Position right now, without subscribing this whole window to the playback ticker
const livePosition = (p) => (p.isActive && !p.isPaused ? p.position + (Date.now() - p.updatedAt) : p.position);

// Back/forward history over { viewMode, source }
const useNavigation = () => {
  const [nav, setNav] = useState({ entries: [{ viewMode: 'mediaLibrary', source: null }], index: 0 });
  const current = nav.entries[nav.index];

  const navigate = useCallback((patch) => {
    setNav(({ entries, index }) => {
      const here = entries[index];
      const next = { ...here, ...patch };
      if (next.viewMode === here.viewMode && sourceKey(next.source) === sourceKey(here.source)) {
        return { entries, index };
      }
      const kept = entries.slice(0, index + 1);
      return { entries: [...kept, next], index: kept.length };
    });
  }, []);

  return {
    ...current,
    navigate,
    canGoBack: nav.index > 0,
    canGoForward: nav.index < nav.entries.length - 1,
    back: () => setNav((n) => ({ ...n, index: Math.max(0, n.index - 1) })),
    forward: () => setNav((n) => ({ ...n, index: Math.min(n.entries.length - 1, n.index + 1) }))
  };
};

const SignInPanel = ({ music }) => {
  const { provider, providerName, serverLabel, status, statusMessage, login, mode } = music;
  const checking = status === 'checking';
  return (
    <div className="wmp-login">
      <div className="wmp-login-content">
        <span className="wmp-icon-large" aria-hidden="true" />
        <h1>Windows Media Player</h1>
        {provider === 'navidrome' ? (
          <>
            <p className="wmp-login-subtitle">
              {checking ? `Connecting to ${serverLabel}…` : `Connect to your ${providerName} server on ${serverLabel}`}
            </p>
            {!checking && statusMessage && <p className="wmp-login-status" role="status">{statusMessage}</p>}
            <ul className="wmp-login-features">
              <li>Your artists, albums, playlists and favorites</li>
              <li>Streams straight from your own library</li>
              <li>MilkDrop-style visualizations</li>
            </ul>
            <button type="button" className="wmp-login-btn" onClick={login} disabled={checking}>
              {checking ? 'Connecting…' : `Connect to ${serverLabel}`}
            </button>
            <p className="wmp-login-note">Server credentials are read from the server's .env and never sent to this page.</p>
          </>
        ) : (
          <>
            <p className="wmp-login-subtitle">Connect to Spotify to access your music library</p>
            <ul className="wmp-login-features">
              <li>Your playlists, liked songs and albums</li>
              <li>{mode === 'connect' ? 'Control Spotify on your phone or speakers' : 'Stream right here in the browser (Premium)'}</li>
              <li>MilkDrop-style visualizations</li>
            </ul>
            <button type="button" className="wmp-login-btn" onClick={login}>Sign In with Spotify</button>
            <p className="wmp-login-note">You'll be redirected to Spotify to authorize Winampify.</p>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Windows Media Player app body (lives inside an OS window).
 * `request` lets the shell deep-link: { type: 'view', view } or { type: 'source', source }.
 */
const MediaPlayer = ({ request, onClose }) => {
  const music = useMusic();
  const { library, capabilities, isAuthenticated, playback, controls, mode, playerError, clearPlayerError, providerName } = music;
  const isMobile = useIsMobile();

  const { viewMode, source, navigate, canGoBack, canGoForward, back, forward } = useNavigation();
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [paneVisible, setPaneVisible] = useState(false);
  const [visualizerOn, setVisualizerOn] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const visualizerRef = useRef(null);

  const trackList = useTrackList(library, source, music.libraryVersion);
  const collections = useLibraryCollections(library, isAuthenticated);
  const artistDetail = useArtistDetail(library, source);
  const searchExtras = useSearchExtras(library, source);
  const currentKey = playback.track?.key;
  const currentTrack = playback.track;
  const currentStarred = music.isStarred(currentTrack);

  // Deep links from the desktop, start menu and Run dialog
  useEffect(() => {
    if (!request) return;
    if (request.type === 'view') {
      setVisualizerOn(false);
      navigate({ viewMode: request.view });
    } else if (request.type === 'source') {
      const target = request.source.type === 'liked' ? LIKED_SOURCE : request.source;
      setVisualizerOn(false);
      navigate({ viewMode: 'mediaLibrary', source: target });
    }
  }, [request?.nonce]);

  const selectView = useCallback((view) => {
    setVisualizerOn(false);
    navigate({ viewMode: view });
  }, [navigate]);

  const toggleVisualizer = useCallback((force) => {
    if (viewMode !== 'nowPlaying' || force === true) {
      navigate({ viewMode: 'nowPlaying' });
      setVisualizerOn(true);
    } else {
      setVisualizerOn((on) => !on);
    }
  }, [navigate, viewMode]);

  const selectPreset = useCallback((index) => {
    setActivePreset(index);
    visualizerRef.current?.loadPreset(index);
  }, []);

  // The whole list becomes the queue (Navidrome) or the Spotify context, starting at the clicked track
  const playTrack = useCallback((track, index) => {
    if (source) controls.playQueue(trackList.tracks, index, source);
  }, [controls, source, trackList.tracks]);

  const playAll = useCallback(() => {
    if (source && trackList.tracks.length) controls.playQueue(trackList.tracks, 0, source);
  }, [controls, source, trackList.tracks]);

  const search = useCallback((query) => {
    setVisualizerOn(false);
    navigate({ viewMode: 'mediaLibrary', source: searchSource(query) });
  }, [navigate]);

  const menus = useMemo(() => [
    {
      id: 'file',
      label: 'File',
      accessKey: 'F',
      items: [
        { label: 'Open Media Library', onSelect: () => selectView('mediaLibrary') },
        { label: 'Open Liked Songs', onSelect: () => navigate({ viewMode: 'mediaLibrary', source: LIKED_SOURCE }), disabled: !isAuthenticated },
        'separator',
        isAuthenticated
          ? { label: `Sign Out of ${providerName}`, onSelect: music.logout }
          : { label: `Connect to ${providerName}…`, onSelect: music.login },
        { label: 'Close', onSelect: onClose }
      ]
    },
    {
      id: 'view',
      label: 'View',
      accessKey: 'V',
      items: [
        { label: 'Now Playing', checked: viewMode === 'nowPlaying' && !visualizerOn, onSelect: () => selectView('nowPlaying') },
        { label: 'Media Library', checked: viewMode === 'mediaLibrary', onSelect: () => selectView('mediaLibrary') },
        { label: 'Playlist', checked: viewMode === 'playlist', onSelect: () => selectView('playlist') },
        { label: 'Visualizations', checked: viewMode === 'nowPlaying' && visualizerOn, onSelect: () => toggleVisualizer(true) },
        'separator',
        { label: 'Toolbar', checked: toolbarVisible, onSelect: () => setToolbarVisible((v) => !v) },
        { label: 'Now Playing Pane', checked: paneVisible, onSelect: () => setPaneVisible((v) => !v) }
      ]
    },
    {
      id: 'play',
      label: 'Play',
      accessKey: 'P',
      items: [
        { label: playback.isActive && !playback.isPaused ? 'Pause' : 'Play', onSelect: controls.togglePlay, disabled: !playback.ready },
        { label: 'Stop', onSelect: controls.stop, disabled: !playback.isActive },
        'separator',
        { label: 'Previous Track', onSelect: controls.previous, disabled: !playback.isActive },
        { label: 'Next Track', onSelect: controls.next, disabled: !playback.isActive },
        { label: 'Rewind 10 Seconds', onSelect: () => controls.seek(livePosition(playback) - SEEK_STEP_MS), disabled: !playback.isActive },
        { label: 'Fast Forward 10 Seconds', onSelect: () => controls.seek(livePosition(playback) + SEEK_STEP_MS), disabled: !playback.isActive },
        'separator',
        { label: 'Shuffle', checked: playback.shuffle, onSelect: controls.toggleShuffle, disabled: !playback.isActive },
        { label: 'Repeat', checked: playback.repeat !== 'off', onSelect: controls.cycleRepeat, disabled: !playback.isActive },
        { label: 'Mute', checked: playback.volume === 0, onSelect: controls.toggleMute, disabled: !playback.canSetVolume },
        ...(mode === 'connect' ? ['separator', { label: 'Play On…', onSelect: () => setDevicesOpen(true) }] : [])
      ]
    },
    {
      id: 'favorites',
      label: 'Favorites',
      accessKey: 'a',
      items: [
        ...(capabilities.star ? [
          {
            label: currentStarred ? 'Remove Current Song from Liked Songs' : 'Add Current Song to Liked Songs',
            onSelect: () => music.toggleStar(currentTrack),
            disabled: !currentTrack
          },
          'separator'
        ] : []),
        { label: 'Liked Songs', onSelect: () => navigate({ viewMode: 'mediaLibrary', source: LIKED_SOURCE }), disabled: !isAuthenticated },
        ...music.playlists.slice(0, 8).map((pl) => ({
          label: pl.name,
          onSelect: () => navigate({ viewMode: 'mediaLibrary', source: playlistSource(pl) })
        }))
      ]
    },
    {
      id: 'go',
      label: 'Go',
      accessKey: 'G',
      items: [
        { label: 'Back', onSelect: back, disabled: !canGoBack },
        { label: 'Forward', onSelect: forward, disabled: !canGoForward },
        { label: 'Media Library Home', onSelect: () => navigate({ viewMode: 'mediaLibrary', source: null }) }
      ]
    }
  ], [back, canGoBack, canGoForward, capabilities.star, controls, currentStarred, currentTrack, forward, isAuthenticated, mode, music, navigate, onClose, paneVisible, playback, providerName, selectView, toggleVisualizer, toolbarVisible, viewMode, visualizerOn]);

  const body = !isAuthenticated ? (
    <SignInPanel music={music} />
  ) : (
    <div className="wmp-content-wrapper">
      <div className="wmp-main-content">
        {viewMode === 'nowPlaying' && (
          <NowPlayingView visualizerOn={visualizerOn} visualizerRef={visualizerRef} activePreset={activePreset} />
        )}
        {viewMode === 'mediaLibrary' && (
          <LibraryView
            source={source}
            onSelectSource={(next) => navigate({ viewMode: 'mediaLibrary', source: next })}
            onSearch={search}
            trackList={trackList}
            collections={collections}
            artistDetail={artistDetail}
            searchExtras={searchExtras}
            currentKey={currentKey}
            onPlayTrack={playTrack}
            onPlayAll={playAll}
            isMobile={isMobile}
          />
        )}
        {viewMode === 'playlist' && (
          <PlaylistView
            source={source}
            trackList={trackList}
            currentKey={currentKey}
            onPlayTrack={playTrack}
            onPlayAll={playAll}
            onOpenLibrary={() => selectView('mediaLibrary')}
            isMobile={isMobile}
          />
        )}
      </div>
      {!isMobile && paneVisible && viewMode !== 'nowPlaying' && (
        <NowPlayingPane onClose={() => setPaneVisible(false)} />
      )}
    </div>
  );

  return (
    <div className={`media-player ${isMobile ? 'mobile' : ''}`}>
      {!isMobile && <MenuBar menus={menus} />}
      {isAuthenticated && !isMobile && toolbarVisible && (
        <Toolbar
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={back}
          onForward={forward}
          onHome={() => navigate({ viewMode: 'mediaLibrary', source: null })}
          viewMode={viewMode}
          visualizerOn={visualizerOn}
          onToggleVisualizer={() => toggleVisualizer()}
          activePreset={activePreset}
          onSelectPreset={selectPreset}
          onSearch={capabilities.search ? search : undefined}
          searchLabel={`Search ${providerName}`}
          searchValue={source?.type === 'search' ? source.query : ''}
        />
      )}
      {isAuthenticated && isMobile && (
        <MobileViewBar
          viewMode={viewMode}
          visualizerOn={visualizerOn}
          onSelectView={selectView}
          onToggleVisualizer={toggleVisualizer}
          activePreset={activePreset}
          onSelectPreset={selectPreset}
        />
      )}
      {playerError && (
        <div className="wmp-error" role="alert">
          <span>{playerError}</span>
          <div className="wmp-error-actions">
            {mode === 'connect' && <button type="button" onClick={() => setDevicesOpen(true)}>Devices…</button>}
            <button type="button" onClick={clearPlayerError}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="window-content">{body}</div>
      {isAuthenticated && (
        <ControlBar
          isMobile={isMobile}
          paneVisible={paneVisible}
          onTogglePane={() => setPaneVisible((v) => !v)}
          onOpenDevices={() => setDevicesOpen(true)}
        />
      )}
      {devicesOpen && <DevicePicker onClose={() => setDevicesOpen(false)} />}
    </div>
  );
};

export default MediaPlayer;
