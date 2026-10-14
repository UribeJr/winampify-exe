import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, retryDelay } from '../src/spotify/api.js';

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

test('Retry-After is honored within limits', () => {
  assert.equal(retryDelay('3'), 3);
  assert.equal(retryDelay('120'), 10);
  assert.equal(retryDelay(null), 2);
  assert.equal(retryDelay('0'), 1);
});

test('a 429 waits as asked, retries, and tells the UI while it waits', async () => {
  const replies = [json(429, { error: 'rate' }, { 'retry-after': '3' }), json(200, { ok: 1 })];
  const slept = [];
  const busy = [];
  const api = createApi({
    getToken: () => 't',
    refresh: async () => null,
    onBusy: (s) => busy.push(s),
    fetchImpl: async () => replies.shift(),
    sleep: async (ms) => { slept.push(ms); }
  });
  assert.deepEqual(await api.request('/api/x'), { ok: 1 });
  assert.deepEqual(slept, [3000]);
  assert.deepEqual(busy, [3, 0]);
});

test('after two retries a 429 becomes an error (and the busy notice clears)', async () => {
  let calls = 0;
  const busy = [];
  const api = createApi({
    getToken: () => 't',
    refresh: async () => null,
    onBusy: (s) => busy.push(s),
    fetchImpl: async () => { calls += 1; return json(429, { error: 'rate' }); },
    sleep: async () => {}
  });
  await assert.rejects(api.request('/api/x'), (err) => err.status === 429);
  assert.equal(calls, 3);
  assert.equal(busy.at(-1), 0);
});

test('identical GETs in flight share one request; writes never do', async () => {
  let calls = 0;
  const api = createApi({
    getToken: () => 't',
    refresh: async () => null,
    fetchImpl: async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return json(200, { n: calls }); }
  });
  const [a, b] = await Promise.all([api.getAlbum('1'), api.getAlbum('1')]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  await Promise.all([api.saveToLibrary(['spotify:track:1']), api.saveToLibrary(['spotify:track:1'])]);
  assert.equal(calls, 3);
  await api.getAlbum('1');
  assert.equal(calls, 4, 'settled requests are not reused');
});

test('library writes send URIs in the query string', async () => {
  const seen = [];
  const api = createApi({ getToken: () => 't', refresh: async () => null, fetchImpl: async (url, opts) => { seen.push([opts.method, url]); return json(200, {}); } });
  await api.removeFromLibrary(['spotify:track:a', 'spotify:album:b']);
  assert.deepEqual(seen, [['DELETE', '/api/me/library?uris=spotify%3Atrack%3Aa%2Cspotify%3Aalbum%3Ab']]);
});
