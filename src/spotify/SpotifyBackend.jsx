import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import useSpotifyAuth from './useSpotifyAuth';
import useSdkEngine from './useSdkEngine';
import useConnectEngine from './useConnectEngine';
import useMediaSession from './useMediaSession';
import { createApi } from './api';
import { isMobileDevice } from '../hooks/useMediaQuery';
import { MusicContext, useStarred } from '../music/MusicContext';
import { createSpotifyLibrary, normalizeSpotifyTrack } from '../music/spotify/library';

const QUEUE_LIMIT = 100; // Spotify caps `uris` playback requests

/**
 * Spotify backend (MUSIC_PROVIDER=spotify): OAuth, Web Playback SDK on desktop and a Spotify
 * Connect remote on phones. Spotify owns the queue, so playQueue maps app sources to context URIs.
 */
export default function SpotifyBackend({ children }) {
  const auth = useSpotifyAuth();
  const tokenRef = useRef(auth.token);
  tokenRef.current = auth.token;

  const api = useMemo(
    () => createApi({ getToken: () => tokenRef.current, refresh: auth.refresh }),
    [auth.refresh]
  );
  const library = useMemo(() => createSpotifyLibrary(api), [api]);

  const isAuthenticated = auth.status === 'authenticated';
  const onMobileDevice = useMemo(isMobileDevice, []);

  const sdk = useSdkEngine({
    enabled: isAuthenticated && !onMobileDevice,
    token: auth.token,
    api,
    refresh: auth.refresh
  });

  const mode = onMobileDevice || sdk.unsupported ? 'connect' : 'sdk';
  const connect = useConnectEngine({ enabled: isAuthenticated && mode === 'connect', api });
  const engine = mode === 'sdk' ? sdk : connect;

  // --- Library data shared by the player, start menu and desktop ---
  const [user, setUser] = useState(null);
  // Spotify apps in development mode only serve allow-listed accounts; others get 403 on every call
  const [accessError, setAccessError] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      setPlaylists([]);
      return undefined;
    }
    let cancelled = false;
    api.getMe()
      .then((me) => { if (!cancelled) setUser({ name: me.display_name }); })
      .catch((err) => {
        if (cancelled || err?.status !== 403) return;
        setAccessError('not_invited');
        auth.logout(); // drop the tokens: back to the sign-in screen with an explanation
      });
    setPlaylistsLoading(true);
    library.getPlaylists()
      .then((list) => { if (!cancelled) setPlaylists(list); })
      .catch((err) => console.error('Failed to load playlists', err))
      .finally(() => { if (!cancelled) setPlaylistsLoading(false); });
    return () => { cancelled = true; };
  }, [api, library, isAuthenticated]);

  const { logout: authLogout } = auth;
  const pauseIfPlaying = engine.controls.pauseIfPlaying;
  const logout = useCallback(() => {
    pauseIfPlaying();
    authLogout();
  }, [authLogout, pauseIfPlaying]);

  // App-model view of playback, plus a playQueue adapter onto Spotify contexts
  const rawTrack = engine.playback.track;
  const track = useMemo(() => normalizeSpotifyTrack(rawTrack), [rawTrack]);
  const playback = useMemo(() => ({ ...engine.playback, track, buffering: false }), [engine.playback, track]);
  const engineControls = engine.controls;
  const controls = useMemo(() => ({
    ...engineControls,
    playQueue: (tracks, index = 0, source) => {
      const start = tracks[index];
      // A followed playlist (songs not listable) plays as a whole
      if (!start) return source?.uri ? engineControls.play({ contextUri: source.uri }) : undefined;
      if (source?.uri && source.type !== 'liked') {
        return engineControls.play({ contextUri: source.uri, offsetUri: start.key });
      }
      const uris = tracks.slice(index, index + QUEUE_LIMIT).filter((t) => t.playable).map((t) => t.key);
      return engineControls.play({ uris });
    }
  }), [engineControls]);

  useMediaSession({
    enabled: mode === 'sdk' && playback.isActive,
    playback,
    controls
  });

  const value = {
    provider: 'spotify',
    providerName: 'Spotify',
    serverLabel: 'Spotify',
    library,
    capabilities: library.capabilities,
    status: auth.status,
    statusMessage: '',
    isAuthenticated,
    authError: auth.authError || accessError,
    clearAuthError: () => { auth.clearAuthError(); setAccessError(null); },
    login: auth.login,
    logout,
    user,
    playlists,
    playlistsLoading,
    mode,
    playback,
    controls,
    audioGraph: null, // Spotify audio is DRM-protected; the visualizer uses a simulated signal
    equalizer: null, // same reason: the audio can't be processed in the browser
    playerError: engine.error,
    clearPlayerError: engine.clearError,
    devices: mode === 'connect' ? connect.devices : [],
    selectedDeviceId: mode === 'connect' ? connect.selectedDeviceId : engine.playback.deviceId,
    ...useStarred(library)
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
