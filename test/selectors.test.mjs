import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTracks, sortTracks, filterAlbums, sortAlbums, decadeOf, decadesOf, byDecade } from '../src/music/selectors.js';

const t = (title, artist, album, extra = {}) => ({ title, artists: [{ name: artist }], album: { name: album }, ...extra });
const tracks = [
  t('Café del Mar', 'Energy 52', 'Café del Mar', { durationMs: 300, addedAt: '2024-01-01T00:00:00Z', year: 1993 }),
  t('Around the World', 'Daft Punk', 'Homework', { durationMs: 200, addedAt: '2025-06-01T00:00:00Z', year: 1997 }),
  t('Aerodynamic', 'Daft Punk', 'Discovery', { durationMs: 250, year: null })
];

test('filter matches every word across title, artist and album, ignoring accents and case', () => {
  assert.deepEqual(filterTracks(tracks, 'cafe').map((x) => x.title), ['Café del Mar']);
  assert.deepEqual(filterTracks(tracks, 'daft discovery').map((x) => x.title), ['Aerodynamic']);
  assert.equal(filterTracks(tracks, '  '), tracks);
  assert.deepEqual(filterAlbums([{ name: 'Homework', artist: 'Daft Punk' }, { name: 'Ok', artist: 'Radiohead' }], 'punk').map((a) => a.name), ['Homework']);
});

test('sorts are stable, numeric where it matters, and keep empty values last both ways', () => {
  assert.deepEqual(sortTracks(tracks, 'artist').map((x) => x.title), ['Around the World', 'Aerodynamic', 'Café del Mar']);
  assert.deepEqual(sortTracks(tracks, 'length', 'desc').map((x) => x.durationMs), [300, 250, 200]);
  assert.deepEqual(sortTracks(tracks, 'added', 'desc').map((x) => x.title), ['Around the World', 'Café del Mar', 'Aerodynamic']);
  assert.deepEqual(sortTracks(tracks, 'year', 'asc').map((x) => x.year), [1993, 1997, null]);
  assert.equal(sortTracks(tracks, null), tracks);
});

test('albums group by decade, newest decade first', () => {
  const albums = [{ name: 'A', year: 1997 }, { name: 'B', year: 2001 }, { name: 'C', year: null }, { name: 'D', year: 1993 }];
  assert.equal(decadeOf(1999), 1990);
  assert.equal(decadeOf(null), null);
  assert.deepEqual(decadesOf(albums), [2000, 1990]);
  assert.deepEqual(byDecade(albums, 1990).map((a) => a.name), ['A', 'D']);
  assert.equal(byDecade(albums, null), albums);
  assert.deepEqual(sortAlbums(albums, 'year', 'desc').map((a) => a.name), ['B', 'A', 'D', 'C']);
});
