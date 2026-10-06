const test = require('node:test');
const assert = require('node:assert/strict');

// Fake Spotify: intercept only api.spotify.com; the test's own requests to the app go through
const realFetch = globalThis.fetch;
const calls = [];
let reply = () => ({ status: 200, body: { ok: true } });
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.spotify.com/')) {
    calls.push(String(url));
    const { status, body } = reply(String(url));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, opts);
};

process.env.NAVIDROME_URL = '';
const app = require('../app');

let server;
let base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.closeAllConnections();
  server.close();
  globalThis.fetch = realFetch;
});

const get = (path, auth = true) => realFetch(base + path, { headers: auth ? { Authorization: 'Bearer t' } : {} });

test('browse routes need a bearer token', async () => {
  for (const path of ['/api/search?q=a', '/api/me/top/artists', '/api/me/following', '/api/artists/abc', '/api/player/queue', '/api/playlists/x/items']) {
    assert.equal((await get(path, false)).status, 401, path);
  }
});

test('search clamps limit to 10 and only allows known types', async () => {
  calls.length = 0;
  const res = await get('/api/search?q=daft%20punk&type=track,album,episode,artist&limit=50&offset=20');
  assert.equal(res.status, 200);
  const url = new URL(calls[0]);
  assert.equal(url.pathname, '/v1/search');
  assert.equal(url.searchParams.get('limit'), '10');
  assert.equal(url.searchParams.get('type'), 'track,album,artist');
  assert.equal(url.searchParams.get('offset'), '20');
  assert.equal((await get('/api/search?q=')).status, 400);
  assert.equal((await get('/api/search?q=x&type=episode')).status, 400);
});

test('playlist items use the new endpoint and a 403 becomes playlist_not_listable', async () => {
  calls.length = 0;
  reply = () => ({ status: 403, body: { error: { status: 403, message: 'Forbidden' } } });
  const res = await get('/api/playlists/37i9dQZF1DXcBWIGoYBM5M/items?limit=500');
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'playlist_not_listable' });
  assert.match(calls[0], /\/playlists\/37i9dQZF1DXcBWIGoYBM5M\/items\?limit=100&offset=0$/);
  reply = () => ({ status: 200, body: { ok: true } });
});

test('ids and types are validated before calling Spotify', async () => {
  calls.length = 0;
  assert.equal((await get('/api/me/top/episodes')).status, 400);
  assert.equal((await get('/api/artists/..%2Fme')).status, 400);
  assert.equal(calls.length, 0);
  await get('/api/me/top/tracks?time_range=forever&limit=999');
  assert.match(calls[0], /\/me\/top\/tracks\?time_range=medium_term&limit=50$/);
});
