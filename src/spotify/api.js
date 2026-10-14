import { API_BASE_URL } from './config.js';

const MAX_RATE_RETRIES = 2;
const MAX_WAIT_S = 10;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seconds to wait from a Retry-After header (missing or unreadable: 2 s), capped
export const retryDelay = (header) => {
  const seconds = Number.parseInt(header, 10);
  return Math.min(MAX_WAIT_S, Math.max(1, Number.isNaN(seconds) ? 2 : seconds));
};

/**
 * Thin client for the Express proxy. `getToken` returns the current access token and
 * `refresh` returns a fresh one (or null); a 401 triggers one refresh + retry.
 * Spotify's rate limit (429) is waited out via Retry-After, up to twice, with `onBusy(seconds)`
 * telling the UI (and `onBusy(0)` when it clears). Identical GETs in flight share one request.
 */
export function createApi({ getToken, refresh, onBusy = () => {}, fetchImpl = (...args) => fetch(...args), sleep = wait }) {
  const send = async (path, { method = 'GET', query, body } = {}, attempt = { auth: false, rate: 0 }) => {
    const token = getToken();
    if (!token) {
      const err = new Error('Not signed in');
      err.status = 401;
      throw err;
    }

    const search = query
      ? '?' + new URLSearchParams(
          Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
      : '';

    const response = await fetchImpl(`${API_BASE_URL}${path}${search}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401 && !attempt.auth) {
      const newToken = await refresh();
      if (newToken) return send(path, { method, query, body }, { ...attempt, auth: true });
    }

    if (response.status === 429 && attempt.rate < MAX_RATE_RETRIES) {
      const seconds = retryDelay(response.headers.get('retry-after'));
      onBusy(seconds);
      await sleep(seconds * 1000);
      const result = await send(path, { method, query, body }, { ...attempt, rate: attempt.rate + 1 });
      onBusy(0);
      return result;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) onBusy(0);
      const err = new Error(data?.error || response.statusText);
      err.status = response.status;
      err.details = data;
      throw err;
    }
    return data;
  };

  const inflight = new Map();
  const request = (path, options = {}) => {
    if ((options.method || 'GET') !== 'GET' || options.body) return send(path, options);
    const key = `${path}?${new URLSearchParams(Object.entries(options.query || {}).filter(([, v]) => v != null && v !== ''))}`;
    if (!inflight.has(key)) {
      inflight.set(key, send(path, options).finally(() => inflight.delete(key)));
    }
    return inflight.get(key);
  };

  const libraryQuery = (uris) => ({ query: { uris: uris.join(',') } });

  return {
    request,

    // Library
    getMe: () => request('/api/me'),
    getPlaylists: (offset = 0, limit = 50) => request('/api/playlists', { query: { offset, limit } }),
    getPlaylistItems: (id, offset = 0, limit = 100) =>
      request(`/api/playlists/${id}/items`, { query: { offset, limit } }),
    getLikedTracks: (offset = 0, limit = 50) => request('/api/library/tracks', { query: { offset, limit } }),
    getSavedAlbums: (offset = 0, limit = 50) => request('/api/library/albums', { query: { offset, limit } }),
    getAlbum: (id) => request(`/api/albums/${id}`),
    getRecentlyPlayed: (limit = 50) => request('/api/player/recently-played', { query: { limit } }),
    getTop: (type, range = 'medium_term', limit = 20) => request(`/api/me/top/${type}`, { query: { time_range: range, limit } }),
    getFollowedArtists: (after) => request('/api/me/following', { query: { limit: 50, after } }),
    getArtist: (id) => request(`/api/artists/${id}`),
    getArtistAlbums: (id, offset = 0) => request(`/api/artists/${id}/albums`, { query: { offset, limit: 50 } }),
    search: (q, types, offset = 0) => request('/api/search', { query: { q, type: types.join(','), offset, limit: 10 } }),
    getQueue: () => request('/api/player/queue'),
    // Your Library: songs and albums by URI, at most 40 per call
    libraryContains: (uris) => request('/api/me/library/contains', libraryQuery(uris)),
    saveToLibrary: (uris) => request('/api/me/library', { method: 'PUT', ...libraryQuery(uris) }),
    removeFromLibrary: (uris) => request('/api/me/library', { method: 'DELETE', ...libraryQuery(uris) }),

    // Playback
    getPlaybackState: () => request('/api/player'),
    getDevices: () => request('/api/player/devices'),
    transfer: (deviceId, play = false) =>
      request('/api/playback/transfer', { method: 'PUT', body: { device_id: deviceId, play } }),
    play: ({ deviceId, contextUri, uris, offset, positionMs } = {}) =>
      request('/api/playback/play', {
        method: 'PUT',
        body: {
          device_id: deviceId || undefined,
          context_uri: contextUri,
          uris,
          offset,
          position_ms: positionMs
        }
      }),
    pause: (deviceId) => request('/api/player/pause', { method: 'PUT', query: { device_id: deviceId } }),
    next: (deviceId) => request('/api/player/next', { method: 'POST', query: { device_id: deviceId } }),
    previous: (deviceId) => request('/api/player/previous', { method: 'POST', query: { device_id: deviceId } }),
    seek: (positionMs, deviceId) =>
      request('/api/player/seek', { method: 'PUT', query: { position_ms: positionMs, device_id: deviceId } }),
    setVolume: (percent, deviceId) =>
      request('/api/player/volume', { method: 'PUT', query: { volume_percent: percent, device_id: deviceId } }),
    setShuffle: (state, deviceId) =>
      request('/api/player/shuffle', { method: 'PUT', query: { state: String(state), device_id: deviceId } }),
    setRepeat: (state, deviceId) =>
      request('/api/player/repeat', { method: 'PUT', query: { state, device_id: deviceId } })
  };
}
