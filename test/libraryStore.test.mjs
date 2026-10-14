import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryStore, memoryPersist, syncSaved } from '../src/music/spotify/libraryStore.js';

// A saved list, newest first, served in pages of 50 like Spotify
const savedList = (n, prefix = 't') => Array.from({ length: n }, (_, i) => ({ uri: `spotify:track:${prefix}${n - i}`, addedAt: `2026-01-01T00:00:${String(n - i).padStart(4, '0')}` }));
const pager = (list, calls) => async (offset) => {
  calls.push(offset);
  return { items: list.slice(offset, offset + 50), total: list.length, next: offset + 50 < list.length ? 'more' : null };
};
const asIs = (x) => x;

test('a first sync reads every page; later ones stop at the first known item', async () => {
  let calls = [];
  const all = savedList(120);
  const first = await syncSaved({ fetchPage: pager(all, calls), toItem: asIs, existing: [], limit: 1000 });
  assert.equal(first.length, 120);
  assert.deepEqual(calls, [0, 50, 100]);

  calls = [];
  const newer = [{ uri: 'spotify:track:new', addedAt: '2026-02-01T00:00:00Z' }, ...all];
  const next = await syncSaved({ fetchPage: pager(newer, calls), toItem: asIs, existing: first, limit: 1000 });
  assert.deepEqual(calls, [0]);
  assert.equal(next.length, 121);
  assert.equal(next[0].uri, 'spotify:track:new');
});

test('a song saved again moves to the top; a removal elsewhere asks for a full read', async () => {
  const all = savedList(5);
  const resaved = { ...all[3], addedAt: '2026-03-01T00:00:00Z' };
  const list = [resaved, ...all.filter((x) => x.uri !== resaved.uri)];
  const merged = await syncSaved({ fetchPage: pager(list, []), toItem: asIs, existing: all, limit: 1000 });
  assert.deepEqual(merged.map((x) => x.uri), list.map((x) => x.uri));

  const removedOld = all.filter((_, i) => i !== 4);
  const withNew = [{ uri: 'spotify:track:new', addedAt: '2026-04-01T00:00:00Z' }, ...removedOld];
  assert.equal(await syncSaved({ fetchPage: pager(withNew, []), toItem: asIs, existing: all, limit: 1000 }), null);
});

function fakeApi(tracks, albums = [], artists = []) {
  const calls = { tracks: [], albums: [], artists: 0 };
  return {
    calls,
    getLikedTracks: async (offset) => { calls.tracks.push(offset); return { items: tracks.slice(offset, offset + 50), total: tracks.length, next: offset + 50 < tracks.length ? 'm' : null }; },
    getSavedAlbums: async (offset) => { calls.albums.push(offset); return { items: albums.slice(offset, offset + 50), total: albums.length, next: offset + 50 < albums.length ? 'm' : null }; },
    getFollowedArtists: async () => { calls.artists += 1; if (artists instanceof Error) throw artists; return { artists: { items: artists, next: null } }; }
  };
}
const entry = (id, added) => ({ track: { uri: `spotify:track:${id}` }, added_at: added });
const normalize = {
  savedTrack: (e) => ({ uri: e.track.uri, addedAt: e.added_at }),
  savedAlbum: (e) => ({ uri: e.album.uri, addedAt: e.added_at }),
  artist: (a) => ({ id: a.id, name: a.name })
};
const noPause = async () => {};

test('the store syncs, saves per user, reopens instantly and skips a sync that just ran', async () => {
  const persist = memoryPersist();
  let clock = 1000;
  const api = fakeApi(Array.from({ length: 60 }, (_, i) => entry(`s${i}`, `2026-01-${String(60 - i).padStart(2, '0')}`)), [], [{ id: 'a1', name: 'Artist' }]);
  const store = createLibraryStore({ api, normalize, persist, pause: noPause, now: () => clock });
  const statuses = [];
  store.subscribe((s) => statuses.push(s.state));
  await store.open('me');
  assert.equal(store.ready, false);
  assert.equal(await store.sync(), true);
  assert.equal(store.ready, true);
  assert.equal(store.getAll('tracks').length, 60);
  assert.equal(store.has('spotify:track:s0'), true);
  assert.ok(statuses.includes('syncing') && statuses.at(-1) === 'ready');

  assert.equal(await store.sync(), false, 'fresh: skipped');
  clock += 16 * 60 * 1000;
  api.calls.tracks.length = 0;
  assert.equal(await store.sync(), true);
  assert.deepEqual(api.calls.tracks, [0], 'incremental: one page');

  const again = createLibraryStore({ api: fakeApi([]), normalize, persist, pause: noPause });
  await again.open('me');
  assert.equal(again.ready, true);
  assert.equal(again.getAll('artists')[0].name, 'Artist');
  await again.open('someone-else');
  assert.equal(again.ready, false);
});

test('add/remove keep the index in step; clear forgets it on disk; no follow permission is not fatal', async () => {
  const persist = memoryPersist();
  const forbidden = Object.assign(new Error('no'), { status: 403 });
  const store = createLibraryStore({ api: fakeApi([entry('x', '2026-01-01')], [], forbidden), normalize, persist, pause: noPause });
  await store.open('me');
  assert.equal(await store.sync(), true);
  assert.deepEqual(store.getAll('artists'), []);
  store.add('tracks', { uri: 'spotify:track:y', addedAt: '2026-05-01' });
  assert.deepEqual(store.getAll('tracks').map((t) => t.uri), ['spotify:track:y', 'spotify:track:x']);
  store.remove('tracks', 'spotify:track:x');
  assert.equal(store.has('spotify:track:x'), false);
  await store.clear();
  assert.equal(store.ready, false);
  assert.equal(await persist.get('spotify:me'), null);
});

test('a failed first sync reports an error and leaves the index unusable', async () => {
  const api = fakeApi([]);
  api.getLikedTracks = async () => { throw Object.assign(new Error('busy'), { status: 429 }); };
  const store = createLibraryStore({ api, normalize, pause: noPause });
  await store.open('me');
  assert.equal(await store.sync(), false);
  assert.equal(store.ready, false);
  assert.deepEqual(store.getStatus(), { state: 'error', status: 429 });
});
