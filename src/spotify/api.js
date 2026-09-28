import { API_BASE_URL } from './config';

/**
 * Thin client for the Express proxy. `getToken` returns the current access token and
 * `refresh` returns a fresh one (or null); a 401 triggers one refresh + retry.
 */
export function createApi({ getToken, refresh }) {
  const request = async (path, { method = 'GET', query, body } = {}, retried = false) => {
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

    const response = await fetch(`${API_BASE_URL}${path}${search}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401 && !retried) {
      const newToken = await refresh();
      if (newToken) return request(path, { method, query, body }, true);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data?.error || response.statusText);
      err.status = response.status;
      err.details = data;
      throw err;
    }
    return data;
  };

  return {
    request,

    // Library
    getMe: () => request('/api/me'),
    getPlaylists: (offset = 0, limit = 50) => request('/api/playlists', { query: { offset, limit } }),
    getPlaylistTracks: (id, offset = 0, limit = 100) =>
      request(`/api/playlists/${id}/tracks`, { query: { offset, limit } }),
    getLikedTracks: (offset = 0, limit = 50) => request('/api/library/tracks', { query: { offset, limit } }),
    getSavedAlbums: (offset = 0, limit = 50) => request('/api/library/albums', { query: { offset, limit } }),
    getAlbum: (id) => request(`/api/albums/${id}`),
    getAudioAnalysis: (id) => request(`/api/audio-analysis/${id}`),

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
