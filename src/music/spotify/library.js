// Spotify Web API objects → app models, plus a library with the same surface as Navidrome's.

const PAGE_SIZE = { playlist: 100, liked: 50 };

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

const normalizePlaylist = (pl) => ({
  id: pl.id,
  name: pl.name,
  uri: pl.uri,
  songCount: pl.tracks?.total ?? 0,
  coverArt: largest(pl.images),
  coverArtSmall: smallest(pl.images)
});

const normalizeAlbum = (al) => ({
  id: al.id,
  name: al.name,
  uri: al.uri,
  artist: (al.artists || []).map((a) => a.name).join(', '),
  artistId: al.artists?.[0]?.id || null,
  coverArt: largest(al.images),
  coverArtSmall: smallest(al.images),
  songCount: al.total_tracks || 0,
  year: al.release_date ? Number(al.release_date.slice(0, 4)) : null
});

const fromItems = (items = []) => items.map((item) => normalizeSpotifyTrack(item?.track)).filter((t) => t && t.key);

/**
 * Spotify library backed by the existing proxy client (src/spotify/api.js).
 * Search/artists/favorites aren't wired for Spotify, so their UI stays hidden rather than half-working.
 */
export function createSpotifyLibrary(api) {
  return {
    id: 'spotify',
    name: 'Spotify',
    capabilities: { search: false, artists: false, star: false, scrobble: false, recentAlbums: false, devices: true },

    async getPlaylists() {
      const all = [];
      let offset = 0;
      while (offset < 200) {
        const page = await api.getPlaylists(offset, 50);
        all.push(...(page.items || []).filter(Boolean));
        if (!page.next) break;
        offset += 50;
      }
      return all.map(normalizePlaylist);
    },

    async getTracks(source, offset = 0) {
      if (source.type === 'playlist') {
        const page = await api.getPlaylistTracks(source.id, offset, PAGE_SIZE.playlist);
        return { tracks: fromItems(page.items), total: page.total ?? 0, hasMore: Boolean(page.next) };
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
      return { tracks: [], total: 0, hasMore: false };
    },

    async getAlbums() {
      const data = await api.getSavedAlbums(0, 50);
      return (data.items || []).map((item) => item.album).filter(Boolean).map(normalizeAlbum);
    },

    getAudioAnalysis: (trackId) => api.getAudioAnalysis(trackId)
  };
}
