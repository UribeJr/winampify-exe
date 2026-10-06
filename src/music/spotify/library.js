// Spotify Web API objects → app models, plus a library with the same surface as Navidrome's.
// Written for Spotify's February 2026 rules for development-mode apps: playlist entries are
// `items[].item` (was `tracks[].track`), only owned/collaborative playlists list their songs,
// and search returns at most 10 results per type per request.
import { TOP_SOURCE, RECENT_SOURCE } from '../models.js';

const PAGE_SIZE = { playlist: 100, liked: 50, search: 10 };
const MAX_PLAYLISTS = 200;
const MAX_ARTISTS = 200;

const bySize = (images = []) => [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
const largest = (images) => bySize(images).pop()?.url || null;
const smallest = (images, min = 64) => {
  const sorted = bySize(images);
  return (sorted.find((img) => (img.width || 0) >= min) || sorted[sorted.length - 1])?.url || null;
};

export const normalizeSpotifyTrack = (track, albumOverride) => {
  if (!track) return null;
  const album = albumOverride || track.album || {};
  return {
    id: track.id,
    key: track.uri,
    uri: track.uri,
    title: track.name,
    artists: (track.artists || []).map((a) => ({ id: a.id || null, name: a.name })),
    album: { id: album.id || null, name: album.name || track.show?.name || '' },
    durationMs: track.duration_ms || 0,
    coverArt: largest(album.images || track.images),
    coverArtSmall: smallest(album.images || track.images),
    starred: false,
    playable: !track.is_local && track.is_playable !== false
  };
};

export const normalizePlaylist = (pl, meId = null) => ({
  id: pl.id,
  name: pl.name,
  uri: pl.uri,
  songCount: pl.items?.total ?? pl.tracks?.total ?? 0,
  // Spotify only lists the songs of playlists you own or collaborate on
  owned: Boolean(pl.collaborative || (meId && pl.owner?.id === meId)),
  owner: pl.owner?.display_name || '',
  coverArt: largest(pl.images),
  coverArtSmall: smallest(pl.images)
});

export const normalizeAlbum = (al) => ({
  id: al.id,
  name: al.name,
  uri: al.uri,
  artist: (al.artists || []).map((a) => a.name).join(', '),
  artistId: al.artists?.[0]?.id || null,
  coverArt: largest(al.images),
  coverArtSmall: smallest(al.images),
  songCount: al.total_tracks || 0,
  year: al.release_date ? Number(al.release_date.slice(0, 4)) : null,
  releaseDate: al.release_date || ''
});

export const normalizeArtist = (ar) => ({
  id: ar.id,
  name: ar.name,
  uri: ar.uri,
  albumCount: 0,
  coverArt: largest(ar.images),
  coverArtSmall: smallest(ar.images)
});

// Playlist entries moved from `track` to `item` in Feb 2026; accept both
const entryTrack = (entry) => entry?.item || entry?.track || null;
const fromItems = (items = []) => items.map((entry) => normalizeSpotifyTrack(entryTrack(entry))).filter((t) => t && t.key);

const uniqueBy = (list, keyOf) => {
  const seen = new Set();
  return list.filter((x) => {
    const k = keyOf(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const isForbidden = (err) => err?.status === 403;

/**
 * Spotify library backed by the proxy client (src/spotify/api.js).
 * Favorites (starring) aren't wired for Spotify, so that UI stays hidden.
 */
export function createSpotifyLibrary(api) {
  let mePromise = null;
  const meId = () => {
    if (!mePromise) mePromise = api.getMe().then((me) => me?.id || null).catch(() => null);
    return mePromise;
  };
  let playlistIndex = new Map(); // id → normalized playlist, to know which ones can list songs

  return {
    id: 'spotify',
    name: 'Spotify',
    capabilities: { search: true, artists: true, star: false, scrobble: false, recentAlbums: true, devices: true },
    labels: { newest: 'Recently Saved', recent: 'Recently Played', searchMeta: 'on Spotify' },

    async getPlaylists() {
      const me = await meId();
      const all = [];
      let offset = 0;
      while (offset < MAX_PLAYLISTS) {
        const page = await api.getPlaylists(offset, 50);
        all.push(...(page.items || []).filter(Boolean));
        if (!page.next) break;
        offset += 50;
      }
      const list = all.map((pl) => normalizePlaylist(pl, me));
      playlistIndex = new Map(list.map((pl) => [pl.id, pl]));
      return list;
    },

    async getTracks(source, offset = 0) {
      if (source.type === 'playlist') {
        const known = playlistIndex.get(source.id);
        const notListable = { tracks: [], total: known?.songCount ?? 0, hasMore: false, notice: 'not_listable' };
        if (known && !known.owned) return notListable;
        try {
          const page = await api.getPlaylistItems(source.id, offset, PAGE_SIZE.playlist);
          return { tracks: fromItems(page.items), total: page.total ?? 0, hasMore: Boolean(page.next) };
        } catch (err) {
          if (isForbidden(err)) return notListable;
          throw err;
        }
      }
      if (source.type === 'liked') {
        const page = await api.getLikedTracks(offset, PAGE_SIZE.liked);
        return { tracks: fromItems(page.items), total: page.total ?? 0, hasMore: Boolean(page.next) };
      }
      if (source.type === 'album') {
        const album = await api.getAlbum(source.id);
        const tracks = (album.tracks?.items || []).map((t) => normalizeSpotifyTrack(t, album));
        return { tracks, total: album.tracks?.total ?? tracks.length, hasMore: false };
      }
      if (source.type === 'search') {
        const data = await api.search(source.query, ['track'], offset);
        const page = data.tracks || {};
        return {
          tracks: (page.items || []).map((t) => normalizeSpotifyTrack(t)).filter(Boolean),
          total: page.total ?? 0,
          hasMore: Boolean(page.next)
        };
      }
      if (source.type === TOP_SOURCE.type) {
        const data = await api.getTop('tracks', 'medium_term', 50);
        const tracks = (data.items || []).map((t) => normalizeSpotifyTrack(t)).filter(Boolean);
        return { tracks, total: tracks.length, hasMore: false };
      }
      if (source.type === RECENT_SOURCE.type) {
        const data = await api.getRecentlyPlayed(50);
        const tracks = uniqueBy(fromItems(data.items), (t) => t.key);
        return { tracks, total: tracks.length, hasMore: false };
      }
      return { tracks: [], total: 0, hasMore: false };
    },

    async getAlbums() {
      const data = await api.getSavedAlbums(0, 50);
      return (data.items || []).map((item) => item.album).filter(Boolean).map(normalizeAlbum);
    },

    // 'newest' → albums you saved most recently; 'recent' → albums of what you played lately
    async getAlbumList(type, size = 12) {
      if (type === 'newest') {
        const data = await api.getSavedAlbums(0, size);
        return (data.items || []).map((item) => item.album).filter(Boolean).map(normalizeAlbum);
      }
      if (type === 'recent') {
        const data = await api.getRecentlyPlayed(50);
        const albums = (data.items || []).map((entry) => entryTrack(entry)?.album).filter(Boolean);
        return uniqueBy(albums, (al) => al.id).slice(0, size).map(normalizeAlbum);
      }
      return [];
    },

    // Followed artists; if you don't follow anyone, your top artists instead
    async getArtists() {
      const artists = [];
      let after;
      try {
        while (artists.length < MAX_ARTISTS) {
          const data = await api.getFollowedArtists(after);
          const page = data.artists || {};
          artists.push(...(page.items || []));
          after = page.cursors?.after;
          if (!page.next || !after) break;
        }
      } catch (err) {
        if (!isForbidden(err)) throw err; // missing scope until the next sign-in
      }
      if (!artists.length) {
        try {
          artists.push(...((await api.getTop('artists', 'medium_term', 30)).items || []));
        } catch (err) {
          if (!isForbidden(err)) throw err;
        }
      }
      return uniqueBy(artists, (a) => a.id).map(normalizeArtist).sort((a, b) => a.name.localeCompare(b.name));
    },

    async getArtist(artistId) {
      const [artist, albums] = await Promise.all([api.getArtist(artistId), api.getArtistAlbums(artistId)]);
      const list = uniqueBy((albums.items || []).map(normalizeAlbum), (al) => al.id)
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
      return { artist: { ...normalizeArtist(artist), albumCount: list.length }, albums: list };
    },

    async search(query) {
      const data = await api.search(query, ['artist', 'album', 'playlist']);
      return {
        artists: (data.artists?.items || []).filter(Boolean).map(normalizeArtist),
        albums: (data.albums?.items || []).filter(Boolean).map(normalizeAlbum),
        playlists: (data.playlists?.items || []).filter(Boolean).map((pl) => normalizePlaylist(pl))
      };
    },

    // Extra dashboard rows. Rows Spotify refuses (a permission added after you signed in) are
    // left out and `needsReauth` asks for a fresh sign-in.
    async getHome() {
      const sections = [{ kind: 'sources', title: 'Made from your listening', items: [TOP_SOURCE, RECENT_SOURCE] }];
      let needsReauth = false;
      try {
        const top = await api.getTop('artists', 'short_term', 12);
        const items = (top.items || []).map(normalizeArtist);
        if (items.length) sections.unshift({ kind: 'artists', title: 'Your Top Artists', items });
      } catch (err) {
        if (isForbidden(err)) needsReauth = true;
        else throw err;
      }
      return { sections, needsReauth };
    },

    // What Spotify will play next (read-only)
    async getQueue() {
      const data = await api.getQueue();
      return {
        current: normalizeSpotifyTrack(data.currently_playing),
        upcoming: (data.queue || []).map((t) => normalizeSpotifyTrack(t)).filter(Boolean)
      };
    },

    getAudioAnalysis: (trackId) => api.getAudioAnalysis(trackId)
  };
}
