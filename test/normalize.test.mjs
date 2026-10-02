import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSong, normalizeAlbum, normalizeSongs, coverArtUrl } from '../src/music/navidrome/normalize.js';

// Shape of a Navidrome 0.64 getAlbum → song entry (sample data)
const SONG = {
  id: 'song0001',
  isDir: false,
  title: 'Sample Song',
  album: 'Sample Album',
  artist: 'Sample Artist',
  coverArt: 'mf-song0001_abc123',
  contentType: 'audio/mp4',
  suffix: 'm4a',
  duration: 1458,
  albumId: 'album0001',
  artistId: 'artist0001',
  type: 'music',
  artists: [{ id: 'artist0001', name: 'Sample Artist' }]
};

test('normalizeSong maps OpenSubsonic songs to the app Track model', () => {
  const track = normalizeSong(SONG);
  assert.equal(track.id, SONG.id);
  assert.equal(track.key, `nd:${SONG.id}`);
  assert.equal(track.title, SONG.title);
  assert.deepEqual(track.artists, [{ id: SONG.artistId, name: 'Sample Artist' }]);
  assert.deepEqual(track.album, { id: SONG.albumId, name: 'Sample Album' });
  assert.equal(track.durationMs, 1458000);
  assert.equal(track.coverArt, `/api/nd/cover/${SONG.coverArt}`);
  assert.equal(track.starred, false);
  assert.equal(track.playable, true);
});

test('normalizeSong falls back to the flat artist field and marks starred', () => {
  const track = normalizeSong({ ...SONG, artists: undefined, starred: '2026-01-01T12:00:00Z' });
  assert.deepEqual(track.artists, [{ id: SONG.artistId, name: 'Sample Artist' }]);
  assert.equal(track.starred, true);
});

test('normalizeSongs drops directories and videos', () => {
  const list = normalizeSongs([SONG, { ...SONG, id: 'dir', isDir: true }, { ...SONG, id: 'vid', type: 'video' }]);
  assert.deepEqual(list.map((t) => t.id), [SONG.id]);
  assert.deepEqual(normalizeSongs(undefined), []);
});

test('normalizeAlbum and cover URLs', () => {
  const album = normalizeAlbum({ id: 'a1', name: 'X', artist: 'Y', artistId: 'r1', coverArt: 'al-a1_1', songCount: 20, year: 2025 });
  assert.equal(album.coverArt, '/api/nd/cover/al-a1_1');
  assert.equal(album.songCount, 20);
  assert.equal(coverArtUrl(null), null);
  assert.equal(coverArtUrl('a b'), '/api/nd/cover/a%20b');
});
