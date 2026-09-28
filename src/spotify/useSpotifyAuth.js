import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL, STORAGE_KEYS } from './config';

// Refresh this long before the access token actually expires
const REFRESH_MARGIN_MS = 60 * 1000;

const safeStorage = (storage) => ({
  get: (key) => { try { return storage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { storage.setItem(key, value); } catch { /* storage blocked */ } },
  remove: (key) => { try { storage.removeItem(key); } catch { /* storage blocked */ } }
});

const local = safeStorage(window.localStorage);
const session = safeStorage(window.sessionStorage);

const readHashParams = () => {
  const params = new URLSearchParams(window.location.hash.substring(1));
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return params;
};

/**
 * Spotify auth: reads tokens from the /callback redirect hash, keeps the access token in
 * sessionStorage (so a reload doesn't force a new login), and refreshes it on a timer and on demand.
 *
 * status: 'checking' | 'authenticated' | 'anonymous'
 */
export default function useSpotifyAuth() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('checking');
  const [authError, setAuthError] = useState(null);
  const expiryRef = useRef(0);
  const refreshPromiseRef = useRef(null);

  const storeAccessToken = useCallback((accessToken, expiresInSeconds) => {
    const expiry = Date.now() + (Number(expiresInSeconds) || 3600) * 1000;
    expiryRef.current = expiry;
    session.set(STORAGE_KEYS.accessToken, accessToken);
    session.set(STORAGE_KEYS.tokenExpiry, String(expiry));
    setToken(accessToken);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    local.remove(STORAGE_KEYS.refreshToken);
    session.remove(STORAGE_KEYS.accessToken);
    session.remove(STORAGE_KEYS.tokenExpiry);
    expiryRef.current = 0;
    setToken('');
    setStatus('anonymous');
  }, []);

  // Returns the new access token, or null if the session can't be refreshed.
  // Concurrent callers share one in-flight request.
  const refresh = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshToken = local.get(STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
      clearSession();
      return Promise.resolve(null);
    }

    refreshPromiseRef.current = fetch(`${API_BASE_URL}/refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`refresh failed (${response.status})`);
        const data = await response.json();
        if (!data.access_token) throw new Error('refresh returned no token');
        if (data.refresh_token) local.set(STORAGE_KEYS.refreshToken, data.refresh_token);
        storeAccessToken(data.access_token, data.expires_in);
        return data.access_token;
      })
      .catch((err) => {
        console.error('Token refresh failed', err);
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [clearSession, storeAccessToken]);

  // Initial token resolution: redirect hash → session → refresh token → anonymous
  useEffect(() => {
    const params = readHashParams();
    const error = params.get('error');
    const hashToken = params.get('access_token');

    if (error) {
      setAuthError(error);
    }

    if (hashToken) {
      const hashRefresh = params.get('refresh_token');
      if (hashRefresh) local.set(STORAGE_KEYS.refreshToken, hashRefresh);
      storeAccessToken(hashToken, params.get('expires_in'));
      return;
    }

    const storedToken = session.get(STORAGE_KEYS.accessToken);
    const storedExpiry = Number(session.get(STORAGE_KEYS.tokenExpiry)) || 0;
    if (storedToken && storedExpiry - Date.now() > REFRESH_MARGIN_MS) {
      expiryRef.current = storedExpiry;
      setToken(storedToken);
      setStatus('authenticated');
      return;
    }

    if (local.get(STORAGE_KEYS.refreshToken)) {
      refresh();
    } else {
      setStatus('anonymous');
    }
  }, [refresh, storeAccessToken]);

  // Proactive refresh shortly before expiry
  useEffect(() => {
    if (!token || !expiryRef.current) return undefined;
    const delay = Math.max(5000, expiryRef.current - Date.now() - REFRESH_MARGIN_MS);
    const timer = setTimeout(refresh, delay);
    return () => clearTimeout(timer);
  }, [token, refresh]);

  const login = useCallback(() => {
    window.location.href = `${API_BASE_URL}/login`;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return {
    token,
    status,
    authError,
    clearAuthError: () => setAuthError(null),
    login,
    logout,
    refresh
  };
}
