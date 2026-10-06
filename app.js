const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { createNavidromeRouter, readConfig, isConfigured } = require('./server/navidrome');

const app = express();
// Pre-selected service on the client's service picker; both are available when configured
const MUSIC_PROVIDER = process.env.MUSIC_PROVIDER === 'spotify' ? 'spotify' : 'navidrome';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || CLIENT_ORIGIN;

// Middleware
app.use(cors({
  origin: CLIENT_ORIGIN
}));
app.use(express.json());
app.use(cookieParser());

// Self-hosted production (`npm start`): serve the Vite build that `npm run build` writes to ./dist.
// On Vercel the CDN serves dist/ and this app only runs as the API function (api/index.js).
const distPath = path.join(__dirname, 'dist');
const serveBuild = process.env.NODE_ENV === 'production' && !process.env.VERCEL;
if (serveBuild) {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  } else {
    console.error('dist/ not found at', distPath, '- run `npm run build` first.');
  }
}

/**
 * Music services this server can offer, for the client's "select your service" screen (no secrets).
 * MUSIC_PROVIDER only picks which one is pre-selected.
 */
app.get('/api/config', (req, res) => {
  const navidromeConfigured = isConfigured(readConfig());
  const spotifyConfigured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  res.json({
    provider: MUSIC_PROVIDER,
    providers: {
      // Friendly server name shown in the UI (not a secret)
      navidrome: { configured: navidromeConfigured, name: process.env.NAVIDROME_NAME || 'Navidrome' },
      spotify: { configured: spotifyConfigured, name: 'Spotify' }
    },
    navidromeConfigured,
    navidromeName: process.env.NAVIDROME_NAME || 'Navidrome',
    spotifyConfigured
  });
});

// Navidrome / OpenSubsonic proxy (allowlisted routes; credentials stay server-side)
app.use('/api/nd', createNavidromeRouter());

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback';
const SPOTIFY_API = 'https://api.spotify.com/v1';

// Generate a random string for state parameter
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Store state values (in production, use Redis or similar)
const stateKey = 'spotify_auth_state';

// Login endpoint - redirects to Spotify authorization
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state, { httpOnly: true, sameSite: 'lax' });

  // Add playlist scopes so we can read private/collaborative playlists
  const scope = [
    'streaming',
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-read-recently-played',
    'user-library-modify',
    'user-top-read',
    'user-follow-read'
  ].join(' ');

  const authQueryParameters = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state,
    show_dialog: 'true' // Always show consent screen to ensure new scopes are granted
  });

  res.redirect('https://accounts.spotify.com/authorize?' + authQueryParameters.toString());
});

// Callback endpoint - handles the redirect from Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(FRONTEND_URL + '/#' +
      new URLSearchParams({
        error: 'state_mismatch'
      }).toString()
    );
  } else {
    res.clearCookie(stateKey);
    
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      json: true
    };

    try {
      const response = await fetch(authOptions.url, {
        method: 'POST',
        headers: authOptions.headers,
        body: new URLSearchParams(authOptions.form)
      });

      const data = await response.json();

      if (response.ok) {
        const access_token = data.access_token;
        const refresh_token = data.refresh_token;

        // Redirect to frontend with tokens
        res.redirect(FRONTEND_URL + '/#' +
          new URLSearchParams({
            access_token: access_token,
            refresh_token: refresh_token,
            expires_in: String(data.expires_in || 3600)
          }).toString()
        );
      } else {
        res.redirect(FRONTEND_URL + '/#' +
          new URLSearchParams({
            error: 'invalid_token'
          }).toString()
        );
      }
    } catch (error) {
      console.error('Error:', error);
      res.redirect(FRONTEND_URL + '/#' +
        new URLSearchParams({
          error: 'server_error'
        }).toString()
      );
    }
  }
});

// Token refresh endpoint
app.post('/refresh_token', async (req, res) => {
  const refresh_token = req.body.refresh_token;

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    })
  };

  try {
    const response = await fetch(authOptions.url, {
      method: 'POST',
      headers: authOptions.headers,
      body: authOptions.body
    });

    const data = await response.json();

    if (response.ok) {
      res.json({
        access_token: data.access_token,
        expires_in: data.expires_in || 3600,
        // Spotify may rotate the refresh token
        refresh_token: data.refresh_token || undefined
      });
    } else {
      res.status(400).json({ error: 'invalid_grant' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * Helpers
 */
const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

// Read-only Spotify GET proxy: `buildUrl(req)` returns the Spotify URL (or null for a bad request)
const spotifyGet = (buildUrl) => async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const url = buildUrl(req);
  if (!url) return res.status(400).json({ error: 'bad_request' });
  try {
    res.json(await spotifyFetch(token, url));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
};

const SPOTIFY_ID = /^[A-Za-z0-9]{1,40}$/;
const SEARCH_TYPES = ['track', 'album', 'artist', 'playlist'];

const getBearer = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7);
  }
  return null;
};

const spotifyFetch = async (token, url, options = {}) => {
  const headers = options.headers ? { ...options.headers } : {};
  headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(url, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const status = resp.status;
    const message = data?.error?.message || resp.statusText || 'Spotify API error';
    const errorPayload = { status, message, details: data };
    console.error(`Spotify API error (${status}):`, message, data);
    throw errorPayload;
  }
  return data;
};

/**
 * Playlist endpoints (proxy)
 */
app.get('/api/playlists', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/playlists?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    console.error('Playlists error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.get('/api/playlists/:id', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { id } = req.params;
  
  // Validate playlist ID format (should be 22 alphanumeric characters)
  if (!id || id.length !== 22) {
    console.error(`Invalid playlist ID format: "${id}" (length: ${id?.length})`);
    return res.status(400).json({ error: 'Invalid playlist ID format' });
  }
  
  try {
    const data = await spotifyFetch(token, `${SPOTIFY_API}/playlists/${id}`);
    res.json(data);
  } catch (err) {
    console.error(`Playlist details error for ID: "${id}" (length: ${id.length})`, err);
    res.status(err.status || 500).json({ error: err.message || 'server_error', details: err.details });
  }
});

// Spotify (Feb 2026): /playlists/{id}/tracks became /items, and contents are only returned for playlists
// the user owns or collaborates on. Other playlists answer 403; they can still be played as a whole.
const playlistItems = async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const limit = clampInt(req.query.limit, 1, 100, 100);
    const offset = clampInt(req.query.offset, 0, 100000, 0);
    const data = await spotifyFetch(token, `${SPOTIFY_API}/playlists/${encodeURIComponent(req.params.id)}/items?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: 'playlist_not_listable' });
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
};
app.get('/api/playlists/:id/items', playlistItems);
app.get('/api/playlists/:id/tracks', playlistItems); // older clients

/**
 * Library (saved) content
 */
app.get('/api/library/tracks', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 50);
    const offset = Number(req.query.offset) || 0;
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/tracks?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    console.error('Saved tracks error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.get('/api/library/albums', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/albums?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    console.error('Saved albums error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.get('/api/library/shows', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/shows?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    console.error('Saved shows error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

/**
 * Album endpoint
 */
app.get('/api/albums/:id', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { id } = req.params;
  try {
    const data = await spotifyFetch(token, `${SPOTIFY_API}/albums/${id}`);
    res.json(data);
  } catch (err) {
    console.error('Album error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

/**
 * Audio Analysis endpoint
 */
app.get('/api/audio-analysis/:id', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { id } = req.params;
  try {
    const data = await spotifyFetch(token, `${SPOTIFY_API}/audio-analysis/${id}`);
    res.json(data);
  } catch (err) {
    console.error('Audio Analysis error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

/**
 * Browse: top items, followed artists, artists, search, queue (all read-only)
 */
app.get('/api/me/top/:type', spotifyGet((req) => {
  if (!['artists', 'tracks'].includes(req.params.type)) return null;
  const range = ['short_term', 'medium_term', 'long_term'].includes(req.query.time_range) ? req.query.time_range : 'medium_term';
  return `${SPOTIFY_API}/me/top/${req.params.type}?time_range=${range}&limit=${clampInt(req.query.limit, 1, 50, 20)}`;
}));

app.get('/api/me/following', spotifyGet((req) => {
  const after = SPOTIFY_ID.test(req.query.after || '') ? `&after=${req.query.after}` : '';
  return `${SPOTIFY_API}/me/following?type=artist&limit=${clampInt(req.query.limit, 1, 50, 50)}${after}`;
}));

app.get('/api/artists/:id', spotifyGet((req) => (
  SPOTIFY_ID.test(req.params.id) ? `${SPOTIFY_API}/artists/${req.params.id}` : null
)));

app.get('/api/artists/:id/albums', spotifyGet((req) => (
  SPOTIFY_ID.test(req.params.id)
    ? `${SPOTIFY_API}/artists/${req.params.id}/albums?include_groups=album,single&limit=${clampInt(req.query.limit, 1, 50, 50)}&offset=${clampInt(req.query.offset, 0, 10000, 0)}`
    : null
)));

// Spotify caps search at 10 results per type per request (Feb 2026); page with offset
app.get('/api/search', spotifyGet((req) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  const types = String(req.query.type || 'track').split(',').filter((t) => SEARCH_TYPES.includes(t));
  if (!q || !types.length) return null;
  const params = new URLSearchParams({
    q,
    type: [...new Set(types)].join(','),
    limit: String(clampInt(req.query.limit, 1, 10, 10)),
    offset: String(clampInt(req.query.offset, 0, 1000, 0))
  });
  return `${SPOTIFY_API}/search?${params}`;
}));

app.get('/api/player/queue', spotifyGet(() => `${SPOTIFY_API}/me/player/queue`));

/**
 * Recently played tracks
 */
app.get('/api/player/recently-played', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const before = req.query.before || null;
    const after = req.query.after || null;
    
    // Build URL according to Spotify API docs: https://api.spotify.com/v1/me/player/recently-played
    let url = `${SPOTIFY_API}/me/player/recently-played?limit=${limit}`;
    if (before) url += `&before=${before}`;
    if (after) url += `&after=${after}`;
    
    const data = await spotifyFetch(token, url);
    res.json(data);
  } catch (err) {
    console.error('Recently played error:', err);
    // If it's a 404, check if it's a scope issue or endpoint issue
    if (err.status === 404) {
      const errorMessage = err.details?.error?.message || err.message || 'Not Found';
      res.status(404).json({ 
        error: 'Not Found', 
        message: errorMessage.includes('scope') || errorMessage.includes('permission') 
          ? 'Missing required permission. Please log out and log back in to grant the user-read-recently-played permission.'
          : 'Recently played endpoint returned 404. Please ensure you have played tracks recently and try logging out and back in.',
        details: err.details
      });
    } else {
      res.status(err.status || 500).json({ 
        error: err.message || 'server_error',
        details: err.details 
      });
    }
  }
});

/**
 * Playback control (proxy)
 */
app.put('/api/playback/transfer', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { device_id, play = true } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'device_id_required' });
  try {
    await spotifyFetch(token, `${SPOTIFY_API}/me/player`, {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [device_id], play })
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Transfer error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.put('/api/playback/play', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { device_id, context_uri, uris, offset, position_ms } = req.body || {};

  const body = {};
  if (context_uri) body.context_uri = context_uri;
  if (Array.isArray(uris)) body.uris = uris;
  if (offset !== undefined) body.offset = offset;
  if (position_ms !== undefined) body.position_ms = position_ms;

  try {
    await spotifyFetch(token, `${SPOTIFY_API}/me/player/play${deviceQuery(device_id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Play error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

/**
 * Spotify Connect remote control (used on mobile, where the Web Playback SDK can't play audio)
 */
const deviceQuery = (deviceId, prefix = '?') =>
  deviceId ? `${prefix}device_id=${encodeURIComponent(deviceId)}` : '';

// Proxies a player command. `buildQuery` returns the Spotify query string (without device_id).
const playerCommand = (method, spotifyPath, buildQuery = () => '') => async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const query = buildQuery(req);
    const device = deviceQuery(req.query.device_id, query ? '&' : '?');
    await spotifyFetch(token, `${SPOTIFY_API}/me/player${spotifyPath}${query}${device}`, { method });
    res.json({ ok: true });
  } catch (err) {
    console.error(`Player ${spotifyPath || '/'} error`, err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
};

app.get('/api/me', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me`);
    res.json({ id: data.id, display_name: data.display_name });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.get('/api/player', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    // Spotify answers 204 (empty) when nothing is active; spotifyFetch turns that into {}
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/player?additional_types=episode`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.get('/api/player/devices', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const data = await spotifyFetch(token, `${SPOTIFY_API}/me/player/devices`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

app.put('/api/player/pause', playerCommand('PUT', '/pause'));
app.post('/api/player/next', playerCommand('POST', '/next'));
app.post('/api/player/previous', playerCommand('POST', '/previous'));
app.put('/api/player/seek', playerCommand('PUT', '/seek',
  (req) => `?position_ms=${Math.max(0, Math.round(Number(req.query.position_ms) || 0))}`));
app.put('/api/player/volume', playerCommand('PUT', '/volume',
  (req) => `?volume_percent=${Math.min(100, Math.max(0, Math.round(Number(req.query.volume_percent) || 0)))}`));
app.put('/api/player/shuffle', playerCommand('PUT', '/shuffle',
  (req) => `?state=${req.query.state === 'true'}`));
app.put('/api/player/repeat', playerCommand('PUT', '/repeat',
  (req) => `?state=${['track', 'context'].includes(req.query.state) ? req.query.state : 'off'}`));

// Serve React app for all non-API routes in production
if (serveBuild) {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/login') || req.path.startsWith('/callback') || req.path.startsWith('/refresh_token')) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath);
  });
}

app.musicProvider = MUSIC_PROVIDER;

module.exports = app;
