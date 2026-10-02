const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createNavidromeRouter, authParams, clampInt, requireId } = require('./navidrome');

const ENV = { NAVIDROME_URL: 'http://navidrome.test:4533/', NAVIDROME_USERNAME: 'admin', NAVIDROME_PASSWORD: 'sesame' };

test('authParams builds Subsonic token auth without the password', () => {
  const params = authParams({ username: 'admin', password: 'sesame', clientId: 'my-player' }, 'c19b2d');
  // md5('sesame' + 'c19b2d') - the example from the Subsonic API docs
  assert.equal(params.t, '26719a1196d2a940705a59634eb18eab');
  assert.equal(params.s, 'c19b2d');
  assert.equal(params.u, 'admin');
  assert.equal(params.c, 'my-player');
  assert.equal(params.f, 'json');
  assert.ok(!Object.values(params).includes('sesame'));
});

test('authParams uses a fresh salt each call', () => {
  const config = { username: 'u', password: 'p' };
  assert.notEqual(authParams(config).s, authParams(config).s);
});

test('param helpers validate ids and clamp numbers', () => {
  assert.equal(requireId('al-123_x'), 'al-123_x');
  assert.throws(() => requireId('../etc/passwd'));
  assert.throws(() => requireId(''));
  assert.equal(clampInt('9999', 0, 50, 10), 50);
  assert.equal(clampInt('abc', 0, 50, 10), 10);
});

// Spins the router up against a fake fetch and returns { baseUrl, calls, close }
async function withRouter(fakeFetch, env = ENV) {
  const calls = [];
  const app = express();
  app.use('/api/nd', createNavidromeRouter({
    env,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return fakeFetch(String(url), init);
    }
  }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}/api/nd`, calls, close: () => { server.closeAllConnections(); server.close(); } };
}

const subsonic = (body) => new Response(JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1', ...body } }), {
  headers: { 'content-type': 'application/json' }
});

test('search proxies search3 via formPost to the configured host only', async () => {
  const ctx = await withRouter(async () => subsonic({ searchResult3: { song: [{ id: 's1', title: 'Hey' }] } }));
  try {
    const res = await fetch(`${ctx.baseUrl}/search?q=hey&songCount=5000`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data.songs, [{ id: 's1', title: 'Hey' }]);
    const [call] = ctx.calls;
    assert.equal(call.url, 'http://navidrome.test:4533/rest/search3');
    assert.equal(call.init.method, 'POST');
    const body = new URLSearchParams(call.init.body.toString());
    assert.equal(body.get('query'), 'hey');
    assert.equal(body.get('songCount'), '200'); // clamped
    assert.ok(body.get('t') && body.get('s'));
    assert.equal(body.get('p'), null);
  } finally {
    ctx.close();
  }
});

test('bad credentials map to 401, unreachable server to 502', async () => {
  const failing = await withRouter(async () => new Response(JSON.stringify({
    'subsonic-response': { status: 'failed', error: { code: 40, message: 'Wrong username or password' } }
  })));
  try {
    const res = await fetch(`${failing.baseUrl}/ping`);
    assert.equal(res.status, 401);
  } finally {
    failing.close();
  }

  const down = await withRouter(async () => { throw new TypeError('fetch failed'); });
  try {
    const res = await fetch(`${down.baseUrl}/ping`);
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /Can't reach Navidrome/);
  } finally {
    down.close();
  }
});

test('unconfigured proxy answers 503 without calling upstream', async () => {
  const ctx = await withRouter(async () => subsonic({}), { NAVIDROME_URL: 'http://x' });
  try {
    const res = await fetch(`${ctx.baseUrl}/ping`);
    assert.equal(res.status, 503);
    assert.equal(ctx.calls.length, 0);
  } finally {
    ctx.close();
  }
});

test('stream forwards Range, requests the original file and passes 206 through', async () => {
  const ctx = await withRouter(async () => new Response(new Uint8Array([1, 2, 3, 4]), {
    status: 206,
    headers: { 'content-type': 'audio/mp4', 'content-range': 'bytes 0-3/100', 'accept-ranges': 'bytes' }
  }));
  try {
    const res = await fetch(`${ctx.baseUrl}/stream/song1`, { headers: { Range: 'bytes=0-3' } });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-type'), 'audio/mp4');
    assert.equal(res.headers.get('content-range'), 'bytes 0-3/100');
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3, 4]);
    const upstream = new URL(ctx.calls[0].url);
    assert.equal(upstream.pathname, '/rest/stream');
    assert.equal(upstream.searchParams.get('format'), 'raw');
    assert.equal(ctx.calls[0].init.headers.Range, 'bytes=0-3');
  } finally {
    ctx.close();
  }
});

test('invalid ids are rejected before reaching Navidrome', async () => {
  const ctx = await withRouter(async () => subsonic({}));
  try {
    const res = await fetch(`${ctx.baseUrl}/stream/..%2F..%2Frest%2FdeleteUser`);
    assert.equal(res.status, 400);
    assert.equal(ctx.calls.length, 0);
  } finally {
    ctx.close();
  }
});
