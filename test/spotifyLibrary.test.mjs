import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpotifyLibrary } from '../src/music/spotify/library.js';

const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });
const track = (id, albumId = 'al1') => ({ id, uri: `spotify:track:${id}`, name: `Song ${id}`, artists: [{ id: 'ar1', name: 'Artist' }], album: { id: albumId, name: `Album ${albumId}`, images: [] }, duration_ms: 1000 });

function fakeApi(overrides = {}) {
  return {
    getMe: async () => ({ id: 'me' }),
    getPlaylists: async () => ({ items: [
      { id: 'mine', name: 'Mine', uri: 'spotify:playlist:mine', owner: { id: 'me' }, items: { total: 2 } },
      { id: 'collab', name: 'Collab', uri: 'spotify:playlist:collab', owner: { id: 'x' }, collaborative: true, tracks: { total: 3 } },
      { id: 'followed', name: 'Followed', uri: 'spotify:playlist:followed', owner: { id: 'spotify' }, items: { total: 50 } }
    ], next: null }),
    getPlaylistItems: async () => ({ items: [{ item: track('a') }, { track: track('b') }], total: 2, next: null }),
    ...overrides
  };
}

test('playlists read both the new (items) and old (tracks) shapes and know which ones list songs', async () => {
  const lib = createSpotifyLibrary(fakeApi());
  const list = await lib.getPlaylists();
  assert.deepEqual(list.map((p) => [p.id, p.songCount, p.owned]), [['mine', 2, true], ['collab', 3, true], ['followed', 50, false]]);
  const page = await lib.getTracks({ type: 'playlist', id: 'mine' });
  assert.deepEqual(page.tracks.map((t) => t.id), ['a', 'b']);
});

test('followed playlists return a notice instead of failing (and are not requested)', async () => {
  let asked = 0;
  const lib = createSpotifyLibrary(fakeApi({ getPlaylistItems: async () => { asked += 1; throw forbidden(); } }));
  await lib.getPlaylists();
  const page = await lib.getTracks({ type: 'playlist', id: 'followed' });
  assert.equal(page.notice, 'not_listable');
  assert.equal(page.total, 50);
  assert.equal(asked, 0);
  // unknown playlist (e.g. opened from search): a 403 also becomes the notice
  const unknown = await lib.getTracks({ type: 'playlist', id: 'other' });
  assert.equal(unknown.notice, 'not_listable');
});

test('search pages tracks 10 at a time; extras include artists, albums and playlists', async () => {
  const calls = [];
  const lib = createSpotifyLibrary(fakeApi({
    search: async (q, types, offset = 0) => {
      calls.push([q, types.join(','), offset]);
      if (types[0] === 'track') return { tracks: { items: [track('s1')], total: 25, next: 'more' } };
      return { artists: { items: [{ id: 'ar1', name: 'A', images: [] }] }, albums: { items: [{ id: 'al1', name: 'B', artists: [] }] }, playlists: { items: [null, { id: 'p', name: 'P' }] } };
    }
  }));
  const page = await lib.getTracks({ type: 'search', query: 'daft' }, 10);
  assert.equal(page.hasMore, true);
  assert.equal(page.total, 25);
  assert.deepEqual(calls[0], ['daft', 'track', 10]);
  const extras = await lib.search('daft');
  assert.deepEqual([extras.artists.length, extras.albums.length, extras.playlists.length], [1, 1, 1]);
});

test('artists: followed first, top artists when you follow nobody (or lack the permission)', async () => {
  const followed = createSpotifyLibrary(fakeApi({
    getFollowedArtists: async () => ({ artists: { items: [{ id: '2', name: 'Zed' }, { id: '1', name: 'Abe' }], next: null } })
  }));
  assert.deepEqual((await followed.getArtists()).map((a) => a.name), ['Abe', 'Zed']);
  const fallback = createSpotifyLibrary(fakeApi({
    getFollowedArtists: async () => { throw forbidden(); },
    getTop: async () => ({ items: [{ id: '3', name: 'Top' }] })
  }));
  assert.deepEqual((await fallback.getArtists()).map((a) => a.name), ['Top']);
});

test('recently played albums are de-duplicated; recent tracks too', async () => {
  const lib = createSpotifyLibrary(fakeApi({
    getRecentlyPlayed: async () => ({ items: [{ track: track('a', 'x') }, { track: track('b', 'x') }, { track: track('a', 'x') }, { track: track('c', 'y') }] })
  }));
  assert.deepEqual((await lib.getAlbumList('recent', 12)).map((a) => a.id), ['x', 'y']);
  assert.deepEqual((await lib.getTracks({ type: 'recent' })).tracks.map((t) => t.id), ['a', 'b', 'c']);
});

test('home drops rows Spotify refuses and asks for a fresh sign-in', async () => {
  const lib = createSpotifyLibrary(fakeApi({ getTop: async () => { throw forbidden(); } }));
  const home = await lib.getHome();
  assert.equal(home.needsReauth, true);
  assert.deepEqual(home.sections.map((s) => s.kind), ['sources']);
  const ok = createSpotifyLibrary(fakeApi({ getTop: async () => ({ items: [{ id: '1', name: 'A' }] }) }));
  assert.deepEqual((await ok.getHome()).sections.map((s) => s.title), ['Your Top Artists', 'Made from your listening']);
});
