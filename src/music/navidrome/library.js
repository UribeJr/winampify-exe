import { API_BASE_URL } from '../../spotify/config';
import { normalizeAlbum, normalizeArtist, normalizePlaylist, normalizeSongs } from './normalize';

const BASE = `${API_BASE_URL}/api/nd`;

async function request(path, { method = 'GET', query } = {}) {
  const search = query ? `?${new URLSearchParams(query)}` : '';
  const response = await fetch(`${BASE}${path}${search}`, { method });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || response.statusText);
    err.status = response.status;
    throw err;
  }
  return data;
}

const id = (value) => encodeURIComponent(value);

/**
 * Navidrome library, talking only to the server's allowlisted /api/nd proxy.
 * Same method surface as the Spotify library in ../spotify/library.js.
 */
export function createNavidromeLibrary() {
  return {
    id: 'navidrome',
    name: 'Navidrome',
    capabilities: { search: true, artists: true, star: true, scrobble: true, recentAlbums: true, devices: false },

    ping: () => request('/ping'),

    getPlaylists: async () => (await request('/playlists')).playlists.map(normalizePlaylist),

    // Navidrome returns whole playlists/albums/favorites in one response, so there's no paging
    async getTracks(source) {
      let tracks = [];
      if (source.type === 'playlist') {
        tracks = normalizeSongs((await request(`/playlist/${id(source.id)}`)).playlist?.entry);
      } else if (source.type === 'album') {
        tracks = normalizeSongs((await request(`/album/${id(source.id)}`)).album?.song)
          .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
      } else if (source.type === 'liked') {
        tracks = normalizeSongs((await request('/starred')).songs);
      } else if (source.type === 'search') {
        tracks = normalizeSongs((await request('/search', { query: { q: source.query, songCount: 100 } })).songs);
      }
      return { tracks, total: tracks.length, hasMore: false };
    },

    getAlbums: async () => (await request('/albums', { query: { type: 'alphabeticalByName', size: 500 } })).albums.map(normalizeAlbum),

    // type: newest | recent | frequent | random | alphabeticalByName
    getAlbumList: async (type, size = 12) => (await request('/albums', { query: { type, size } })).albums.map(normalizeAlbum),

    getArtists: async () => (await request('/artists')).artists.map(normalizeArtist),

    async getArtist(artistId) {
      const { artist } = await request(`/artist/${id(artistId)}`);
      return { artist: normalizeArtist(artist), albums: (artist.album || []).map(normalizeAlbum) };
    },

    async search(query, { songCount = 100 } = {}) {
      const data = await request('/search', { query: { q: query, songCount, albumCount: 30, artistCount: 20 } });
      return {
        artists: data.artists.map(normalizeArtist),
        albums: data.albums.map(normalizeAlbum),
        songs: normalizeSongs(data.songs)
      };
    },

    star: (trackId) => request(`/star/${id(trackId)}`, { method: 'POST' }),
    unstar: (trackId) => request(`/unstar/${id(trackId)}`, { method: 'POST' }),
    scrobble: (trackId, submission) =>
      request(`/scrobble/${id(trackId)}`, { method: 'POST', query: { submission: String(Boolean(submission)) } }),

    // Original file by default (M4A/AAC plays natively); transcode is the fallback for unsupported codecs
    getStreamUrl: (trackId, { transcode = false } = {}) =>
      `${BASE}/stream/${id(trackId)}${transcode ? '?transcode=1' : ''}`,

    // Spotify-only visualizer data
    getAudioAnalysis: null
  };
}
