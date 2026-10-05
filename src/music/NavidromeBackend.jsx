import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MusicContext, useStarred } from './MusicContext';
import { createNavidromeLibrary } from './navidrome/library';
import useAudioEngine from './useAudioEngine';
import useMediaSession from '../spotify/useMediaSession';

/**
 * Navidrome backend: library via the /api/nd proxy, playback via one local <audio> element.
 * There's no OAuth - the server holds the credentials - so "signed in" means the proxy's ping succeeds.
 */
export default function NavidromeBackend({ children, config = {} }) {
  const library = useMemo(createNavidromeLibrary, []);
  const [status, setStatus] = useState('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [user, setUser] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  const isAuthenticated = status === 'authenticated';
  const engine = useAudioEngine({ enabled: true, library });
  const starred = useStarred(library);

  const connect = useCallback(async () => {
    setStatus('checking');
    try {
      const info = await library.ping();
      setUser({ name: info.username });
      setStatusMessage(`Connected to Navidrome ${info.serverVersion || ''}`.trim());
      setStatus('authenticated');
    } catch (err) {
      setUser(null);
      setStatusMessage(err.message || 'Couldn\'t connect to Navidrome.');
      setStatus('anonymous');
    }
  }, [library]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPlaylists([]);
      return undefined;
    }
    let cancelled = false;
    setPlaylistsLoading(true);
    library.getPlaylists()
      .then((list) => { if (!cancelled) setPlaylists(list); })
      .catch((err) => console.error('Failed to load playlists', err))
      .finally(() => { if (!cancelled) setPlaylistsLoading(false); });
    return () => { cancelled = true; };
  }, [library, isAuthenticated]);

  const { clear } = engine.controls;
  const { resetStarred } = starred;
  // "Log off": stop playback and forget the queue. Credentials live on the server, so this is local only.
  const logout = useCallback(() => {
    clear();
    resetStarred();
    setStatusMessage('Signed out. Connect again to browse your library.');
    setStatus('anonymous');
  }, [clear, resetStarred]);

  useMediaSession({ enabled: engine.playback.isActive, playback: engine.playback, controls: engine.controls });

  const value = {
    provider: 'navidrome',
    providerName: 'Navidrome',
    serverLabel: config.navidromeName || 'Navidrome',
    library,
    capabilities: library.capabilities,
    status,
    statusMessage,
    isAuthenticated,
    authError: null,
    clearAuthError: () => {},
    login: connect,
    logout,
    user,
    playlists,
    playlistsLoading,
    mode: 'local',
    playback: engine.playback,
    controls: engine.controls,
    audioGraph: engine.audioGraph, // { context, analyser } for the visualizer, once playback has started
    playerError: engine.error,
    clearPlayerError: engine.clearError,
    devices: [],
    selectedDeviceId: 'local',
    ...starred
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
