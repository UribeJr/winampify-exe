import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../spotify/config';

/**
 * One context for the whole Win98 UI, whichever backend is active. Value shape:
 * {
 *   provider, providerName, library, capabilities,
 *   status: 'checking'|'authenticated'|'anonymous', statusMessage, isAuthenticated,
 *   authError, clearAuthError, login, logout, user: { name } | null,
 *   playlists, playlistsLoading, libraryVersion,
 *   mode: 'local'|'sdk'|'connect', playback, controls (incl. playQueue), playerError, clearPlayerError,
 *   devices, selectedDeviceId, isStarred(track), toggleStar(track)
 * }
 */
export const MusicContext = createContext(null);

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within a MusicProvider');
  return ctx;
};

// Favorites with optimistic updates. `libraryVersion` bumps so cached lists (Liked Songs) refetch.
export function useStarred(library) {
  const [overrides, setOverrides] = useState(() => new Map());
  const [libraryVersion, setLibraryVersion] = useState(0);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const isStarred = useCallback((track) => {
    if (!track) return false;
    return overrides.has(track.id) ? overrides.get(track.id) : Boolean(track.starred);
  }, [overrides]);

  const toggleStar = useCallback(async (track) => {
    if (!track || !library?.capabilities.star) return;
    const current = overridesRef.current.has(track.id) ? overridesRef.current.get(track.id) : Boolean(track.starred);
    const next = !current;
    setOverrides((m) => new Map(m).set(track.id, next));
    try {
      await (next ? library.star(track.id) : library.unstar(track.id));
      setLibraryVersion((v) => v + 1);
    } catch (err) {
      console.error('Favorite update failed', err);
      setOverrides((m) => new Map(m).set(track.id, current));
    }
  }, [library]);

  const reset = useCallback(() => setOverrides(new Map()), []);

  return { isStarred, toggleStar, libraryVersion, resetStarred: reset };
}

/**
 * Picks the backend from the server's MUSIC_PROVIDER (GET /api/config) and renders it.
 * Backends are loaded lazily so the Spotify SDK code never loads in Navidrome mode.
 */
export function MusicProvider({ children, backends }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/config`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setConfig({ provider: 'navidrome' }); });
    return () => { cancelled = true; };
  }, []);

  if (!config) return null;
  const Backend = backends[config.provider === 'spotify' ? 'spotify' : 'navidrome'];
  return <Backend config={config}>{children}</Backend>;
}
