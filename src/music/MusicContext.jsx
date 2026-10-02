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

const PROVIDER_KEY = 'winampify_provider';
const PROVIDERS = ['navidrome', 'spotify'];

const savedProvider = () => {
  // Coming back from Spotify's OAuth redirect always means Spotify
  if (/access_token=|error=/.test(window.location.hash)) return 'spotify';
  try {
    const saved = localStorage.getItem(PROVIDER_KEY);
    return PROVIDERS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

/**
 * Which music service is active, and how to change it. Value:
 * { config, provider: 'navidrome'|'spotify'|null, services: [{ id, name, configured }],
 *   chooseProvider(id), switchProvider() }
 */
export const ServiceContext = createContext(null);
export const useService = () => useContext(ServiceContext);

/**
 * Lets the user pick a music service (remembered per browser) and renders that backend.
 * Until one is picked, `fallback` provides an idle context so the desktop still renders.
 * Backends are loaded lazily so the Spotify SDK code never loads unless Spotify is chosen.
 */
export function MusicProvider({ children, backends, fallback: Fallback }) {
  const [config, setConfig] = useState(null);
  const [provider, setProvider] = useState(savedProvider);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/config`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data) => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setConfig({ provider: 'navidrome', providers: {} }); });
    return () => { cancelled = true; };
  }, []);

  const chooseProvider = useCallback((id) => {
    try { localStorage.setItem(PROVIDER_KEY, id); } catch { /* storage blocked: choice lasts this visit */ }
    setProvider(id);
  }, []);

  const switchProvider = useCallback(() => {
    try { localStorage.removeItem(PROVIDER_KEY); } catch { /* storage blocked */ }
    setProvider(null);
  }, []);

  if (!config) return null;

  const services = PROVIDERS.map((id) => ({
    id,
    name: config.providers?.[id]?.name || (id === 'spotify' ? 'Spotify' : 'Navidrome'),
    configured: Boolean(config.providers?.[id]?.configured)
  }));
  // A saved choice the server can no longer serve falls back to the picker
  const active = services.find((svc) => svc.id === provider && svc.configured) ? provider : null;
  const Backend = active ? backends[active] : Fallback;

  return (
    <ServiceContext.Provider value={{ config, provider: active, services, chooseProvider, switchProvider }}>
      <Backend key={active || 'none'} config={config}>{children}</Backend>
    </ServiceContext.Provider>
  );
}
