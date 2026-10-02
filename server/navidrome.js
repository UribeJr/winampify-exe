/**
 * Navidrome (OpenSubsonic) proxy.
 *
 * The browser never sees Navidrome credentials: Express signs every upstream request with
 * Subsonic token auth (fresh salt per call) using NAVIDROME_* from the server .env.
 * Only an allowlist of routes/params is exposed, and the upstream host is fixed by config.
 */
const crypto = require('crypto');
const express = require('express');
const { Readable } = require('stream');

const API_VERSION = '1.16.1';
const JSON_TIMEOUT_MS = 10000;
const ID_PATTERN = /^[\w-]{1,64}$/;
const ALBUM_LIST_TYPES = ['newest', 'recent', 'frequent', 'random', 'alphabeticalByName', 'alphabeticalByArtist', 'starred'];

const readConfig = (env = process.env) => ({
  url: (env.NAVIDROME_URL || '').replace(/\/+$/, ''),
  username: env.NAVIDROME_USERNAME || '',
  password: env.NAVIDROME_PASSWORD || '',
  // Shown as this player's name in Navidrome's Players list
  clientId: env.NAVIDROME_CLIENT_ID || 'winampify'
});

const isConfigured = (config) => Boolean(config.url && config.username && config.password);

// Subsonic token auth: t = md5(password + salt), with a new random salt every request
function authParams(config, salt = crypto.randomBytes(8).toString('hex')) {
  return {
    u: config.username,
    t: crypto.createHash('md5').update(config.password + salt).digest('hex'),
    s: salt,
    v: API_VERSION,
    c: config.clientId || 'winampify',
    f: 'json'
  };
}

class NavidromeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Subsonic error codes → HTTP status for the browser
const SUBSONIC_STATUS = { 10: 400, 40: 401, 41: 401, 50: 403, 70: 404 };

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const requireId = (id) => {
  if (!ID_PATTERN.test(id || '')) throw new NavidromeError(400, 'Invalid id');
  return id;
};

function createNavidromeRouter({ env = process.env, fetchImpl = fetch } = {}) {
  const router = express.Router();
  const config = readConfig(env);

  const unreachable = () => new NavidromeError(502, `Can't reach Navidrome at ${config.url}. Is the server on and reachable from this machine?`);

  // JSON methods use the formPost extension so auth tokens stay out of upstream URLs/logs
  async function call(method, params = {}) {
    if (!isConfigured(config)) {
      throw new NavidromeError(503, 'Navidrome isn\'t configured. Set NAVIDROME_URL, NAVIDROME_USERNAME and NAVIDROME_PASSWORD in .env and restart the server.');
    }
    let response;
    try {
      response = await fetchImpl(`${config.url}/rest/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...params, ...authParams(config) }),
        signal: AbortSignal.timeout(JSON_TIMEOUT_MS)
      });
    } catch {
      throw unreachable();
    }
    const data = await response.json().catch(() => null);
    const payload = data?.['subsonic-response'];
    if (!payload) throw new NavidromeError(502, `Navidrome returned an unexpected response (${response.status}).`);
    if (payload.status !== 'ok') {
      const code = payload.error?.code;
      const message = code === 40 || code === 41
        ? 'Navidrome rejected the username/password in .env.'
        : payload.error?.message || 'Navidrome request failed.';
      throw new NavidromeError(SUBSONIC_STATUS[code] || 502, message);
    }
    return payload;
  }

  // Wraps a handler that returns JSON; errors become { error } with a sensible status
  const json = (handler) => async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      const status = err instanceof NavidromeError ? err.status : 500;
      if (status >= 500) console.error(`Navidrome ${req.method} ${req.path}:`, err.message);
      res.status(status).json({ error: err.message });
    }
  };

  // Binary passthrough (stream, cover art). Forwards Range so the <audio> element can seek.
  async function pipeBinary(req, res, method, params, passHeaders, successHeaders = {}) {
    if (!isConfigured(config)) {
      res.status(503).json({ error: 'Navidrome isn\'t configured.' });
      return;
    }
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    const query = new URLSearchParams({ ...params, ...authParams(config) });
    let upstream;
    try {
      upstream = await fetchImpl(`${config.url}/rest/${method}?${query}`, {
        headers: req.headers.range ? { Range: req.headers.range } : {},
        signal: controller.signal
      });
    } catch {
      if (!res.headersSent) res.status(502).json({ error: unreachable().message });
      return;
    }
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || type.includes('json') || type.includes('xml')) {
      // Subsonic reports errors (e.g. not found) as a JSON body
      const body = await upstream.text().catch(() => '');
      const notFound = /"code":\s*70/.test(body);
      res.status(notFound ? 404 : upstream.ok ? 502 : upstream.status).json({ error: notFound ? 'Not found' : 'Navidrome stream failed' });
      return;
    }
    res.status(upstream.status);
    Object.entries(successHeaders).forEach(([name, value]) => res.setHeader(name, value));
    passHeaders.forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    });
    Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
  }

  router.get('/ping', json(async () => {
    const payload = await call('ping');
    return { ok: true, serverVersion: payload.serverVersion, openSubsonic: Boolean(payload.openSubsonic), username: config.username };
  }));

  router.get('/search', json(async (req) => {
    const query = String(req.query.q || '').trim().slice(0, 200);
    if (!query) return { artists: [], albums: [], songs: [] };
    const payload = await call('search3', {
      query,
      artistCount: clampInt(req.query.artistCount, 0, 50, 10),
      albumCount: clampInt(req.query.albumCount, 0, 100, 20),
      songCount: clampInt(req.query.songCount, 0, 200, 50)
    });
    const result = payload.searchResult3 || {};
    return { artists: result.artist || [], albums: result.album || [], songs: result.song || [] };
  }));

  router.get('/artists', json(async () => {
    const payload = await call('getArtists');
    return { artists: (payload.artists?.index || []).flatMap((index) => index.artist || []) };
  }));

  router.get('/artist/:id', json(async (req) => {
    const payload = await call('getArtist', { id: requireId(req.params.id) });
    return { artist: payload.artist };
  }));

  router.get('/album/:id', json(async (req) => {
    const payload = await call('getAlbum', { id: requireId(req.params.id) });
    return { album: payload.album };
  }));

  router.get('/albums', json(async (req) => {
    const type = ALBUM_LIST_TYPES.includes(req.query.type) ? req.query.type : 'alphabeticalByName';
    const payload = await call('getAlbumList2', {
      type,
      size: clampInt(req.query.size, 1, 500, 50),
      offset: clampInt(req.query.offset, 0, 100000, 0)
    });
    return { albums: payload.albumList2?.album || [] };
  }));

  router.get('/song/:id', json(async (req) => {
    const payload = await call('getSong', { id: requireId(req.params.id) });
    return { song: payload.song };
  }));

  router.get('/playlists', json(async () => {
    const payload = await call('getPlaylists');
    return { playlists: payload.playlists?.playlist || [] };
  }));

  router.get('/playlist/:id', json(async (req) => {
    const payload = await call('getPlaylist', { id: requireId(req.params.id) });
    return { playlist: payload.playlist };
  }));

  router.get('/starred', json(async () => {
    const payload = await call('getStarred2');
    const starred = payload.starred2 || {};
    return { songs: starred.song || [], albums: starred.album || [], artists: starred.artist || [] };
  }));

  router.post('/star/:id', json(async (req) => {
    await call('star', { id: requireId(req.params.id) });
    return { ok: true };
  }));

  router.post('/unstar/:id', json(async (req) => {
    await call('unstar', { id: requireId(req.params.id) });
    return { ok: true };
  }));

  router.post('/scrobble/:id', json(async (req) => {
    await call('scrobble', {
      id: requireId(req.params.id),
      submission: String(req.query.submission === 'true'),
      time: String(Date.now())
    });
    return { ok: true };
  }));

  router.get('/stream/:id', async (req, res) => {
    let id;
    try { id = requireId(req.params.id); } catch (err) { res.status(400).json({ error: err.message }); return; }
    // Original file (M4A/AAC plays natively); transcode=1 is the fallback for codecs the browser can't decode
    const params = req.query.transcode === '1'
      ? { id, format: 'mp3', maxBitRate: '320' }
      : { id, format: 'raw' };
    await pipeBinary(req, res, 'stream', params, ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']);
  });

  router.get('/cover/:id', async (req, res) => {
    let id;
    try { id = requireId(req.params.id); } catch (err) { res.status(400).json({ error: err.message }); return; }
    await pipeBinary(req, res, 'getCoverArt', { id, size: String(clampInt(req.query.size, 32, 1200, 300)) },
      ['content-type', 'content-length', 'last-modified', 'etag'],
      { 'Cache-Control': 'private, max-age=604800' });
  });

  return router;
}

module.exports = { createNavidromeRouter, authParams, readConfig, isConfigured, clampInt, requireId, ID_PATTERN };
