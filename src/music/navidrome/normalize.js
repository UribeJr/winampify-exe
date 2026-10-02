// OpenSubsonic (Navidrome) JSON → app models (src/music/models.js).
// This is the only place OpenSubsonic field names should appear.

const COVER_BASE = '/api/nd/cover/';

export const coverArtUrl = (coverArtId) => (coverArtId ? `${COVER_BASE}${encodeURIComponent(coverArtId)}` : null);

const artistRefs = (item) => {
  if (Array.isArray(item.artists) && item.artists.length) {
    return item.artists.map((a) => ({ id: a.id || null, name: a.name }));
  }
  return item.artist ? [{ id: item.artistId || null, name: item.displayArtist || item.artist }] : [];
};

export const normalizeSong = (song) => ({
  id: song.id,
  key: `nd:${song.id}`,
  title: song.title || song.path || 'Untitled',
  artists: artistRefs(song),
  album: { id: song.albumId || null, name: song.album || '' },
  durationMs: (Number(song.duration) || 0) * 1000,
  coverArt: coverArtUrl(song.coverArt || song.albumId),
  starred: Boolean(song.starred),
  playable: song.isDir !== true && song.type !== 'video',
  trackNumber: song.track || null,
  suffix: song.suffix || null
});

export const normalizeAlbum = (album) => ({
  id: album.id,
  name: album.name || album.title || 'Unknown Album',
  artist: album.displayArtist || album.artist || '',
  artistId: album.artistId || null,
  coverArt: coverArtUrl(album.coverArt || album.id),
  songCount: Number(album.songCount) || 0,
  year: album.year || null
});

export const normalizeArtist = (artist) => ({
  id: artist.id,
  name: artist.name,
  albumCount: Number(artist.albumCount) || 0,
  coverArt: coverArtUrl(artist.coverArt)
});

export const normalizePlaylist = (playlist) => ({
  id: playlist.id,
  name: playlist.name,
  songCount: Number(playlist.songCount) || 0,
  coverArt: coverArtUrl(playlist.coverArt)
});

const songsOf = (list) => (list || []).map(normalizeSong).filter((t) => t.playable);

export const normalizeSongs = songsOf;
