import React, { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import useSpotifyAuth from './useSpotifyAuth';
import useSdkEngine from './useSdkEngine';
import useConnectEngine from './useConnectEngine';
import useMediaSession from './useMediaSession';
import { createApi } from './api';
import { isMobileDevice } from '../hooks/useMediaQuery';

const MAX_PLAYLISTS = 200;

const SpotifyContext = createContext(null);

export const useSpotify = () => {
  const ctx = useContext(SpotifyContext);
  if (!ctx) throw new Error('useSpotify must be used within a SpotifyProvider');
  return ctx;
};

export function SpotifyProvider({ children }) {
  const auth = useSpotifyAuth();
  const tokenRef = useRef(auth.token);
  tokenRef.current = auth.token;

  const api = useMemo(
    () => createApi({ getToken: () => tokenRef.current, refresh: auth.refresh }),
    [auth.refresh]
  );

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
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      setPlaylists([]);
      return undefined;
    }
    let cancelled = false;

    api.getMe().then((me) => { if (!cancelled) setUser(me); }).catch(() => {});

    const loadPlaylists = async () => {
      setPlaylistsLoading(true);
      const all = [];
      try {
        let offset = 0;
        while (offset < MAX_PLAYLISTS) {
          const page = await api.getPlaylists(offset, 50);
          all.push(...(page.items || []).filter(Boolean));
          if (!page.next) break;
          offset += 50;
        }
      } catch (err) {
        console.error('Failed to load playlists', err);
      } finally {
        if (!cancelled) {
          setPlaylists(all);
          setPlaylistsLoading(false);
        }
      }
    };
    loadPlaylists();

    return () => { cancelled = true; };
  }, [api, isAuthenticated]);

  const { logout: authLogout } = auth;
  const pauseIfPlaying = engine.controls.pauseIfPlaying;
  const logout = useCallback(() => {
    pauseIfPlaying();
    authLogout();
  }, [authLogout, pauseIfPlaying]);

  useMediaSession({
    enabled: mode === 'sdk' && engine.playback.isActive,
    playback: engine.playback,
    controls: engine.controls
  });

  const value = {
    // auth
    status: auth.status,
    isAuthenticated,
    authError: auth.authError,
    clearAuthError: auth.clearAuthError,
    login: auth.login,
    logout,
    api,
    user,
    // library
    playlists,
    playlistsLoading,
    // playback
    mode,
    playback: engine.playback,
    controls: engine.controls,
    playerError: engine.error,
    clearPlayerError: engine.clearError,
    devices: mode === 'connect' ? connect.devices : [],
    selectedDeviceId: mode === 'connect' ? connect.selectedDeviceId : engine.playback.deviceId
  };

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}
