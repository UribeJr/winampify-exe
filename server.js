const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || CLIENT_ORIGIN;

// Middleware
app.use(cors({
  origin: CLIENT_ORIGIN
}));
app.use(express.json());
app.use(cookieParser());

// Store distPath globally for use in routes (must be declared before use)
let distPath = null;

// Serve static files from the Vite build directory in production
if (process.env.NODE_ENV === 'production') {
  // Render builds dist/ in project root, but may run server from different directory
  // Try paths relative to both __dirname and process.cwd(), going up to project root
  const possibleDistPaths = [
    path.resolve(process.cwd(), '..', 'dist'),  // Go up from cwd to project root
    path.resolve(__dirname, '..', 'dist'),        // Go up from __dirname
    path.resolve(process.cwd(), 'dist'),         // Direct from cwd
    path.resolve(__dirname, 'dist'),              // Direct from __dirname
    '/opt/render/project/dist',                   // Absolute path (Render standard)
    path.join(process.cwd(), '..', 'dist')        // Alternative join
  ];
  
  for (const possiblePath of possibleDistPaths) {
    if (fs.existsSync(possiblePath)) {
      distPath = possiblePath;
      console.log('✓ Found dist folder at:', distPath);
      break;
    }
  }
  
  if (!distPath) {
    console.error('ERROR: Could not find dist folder. Tried:', possibleDistPaths);
    console.error('Current working directory:', process.cwd());
    console.error('__dirname:', __dirname);
    // List what actually exists - check multiple levels
    try {
      console.error('=== Directory Contents Debug ===');
      const cwdContents = fs.readdirSync(process.cwd());
      console.error('Contents of cwd (' + process.cwd() + '):', cwdContents);
      
      const parentPath = path.resolve(process.cwd(), '..');
      if (fs.existsSync(parentPath)) {
        const parentContents = fs.readdirSync(parentPath);
        console.error('Contents of parent (' + parentPath + '):', parentContents);
      }
      
      // Check project root directly
      const projectRoot = '/opt/render/project';
      if (fs.existsSync(projectRoot)) {
        const rootContents = fs.readdirSync(projectRoot);
        console.error('Contents of project root (' + projectRoot + '):', rootContents);
        // Check if dist exists in root
        const distInRoot = path.join(projectRoot, 'dist');
        if (fs.existsSync(distInRoot)) {
          console.error('✓ Found dist in project root!');
          distPath = distInRoot;
        }
      }
      
      // Also check if there's a build folder or other output
      const buildPaths = [
        path.join(process.cwd(), 'build'),
        path.join(process.cwd(), '..', 'build'),
        '/opt/render/project/build'
      ];
      for (const buildPath of buildPaths) {
        if (fs.existsSync(buildPath)) {
          console.error('Found build folder at:', buildPath);
        }
      }
    } catch (e) {
      console.error('Could not read directories:', e.message);
    }
  }
  
  if (distPath) {
    console.log('Serving static files from:', distPath);
    app.use(express.static(distPath));
  } else {
    console.error('WARNING: dist folder not found. Static files will not be served.');
  }
}

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
  res.cookie(stateKey, state);

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
    'user-read-recently-played'
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
            refresh_token: refresh_token
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
        access_token: data.access_token
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
    console.log(`Fetching playlist ${id} from Spotify API`);
    const data = await spotifyFetch(token, `${SPOTIFY_API}/playlists/${id}`);
    console.log(`Successfully fetched playlist: ${data.name} (${data.id})`);
    res.json(data);
  } catch (err) {
    console.error(`Playlist details error for ID: "${id}" (length: ${id.length})`, err);
    res.status(err.status || 500).json({ error: err.message || 'server_error', details: err.details });
  }
});

app.get('/api/playlists/:id/tracks', async (req, res) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { id } = req.params;
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const data = await spotifyFetch(token, `${SPOTIFY_API}/playlists/${id}/tracks?limit=${limit}&offset=${offset}`);
    res.json(data);
  } catch (err) {
    console.error('Playlist tracks error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

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
    
    console.log('Fetching recently played from:', url);
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
  const { device_id, context_uri, uris, offset } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'device_id_required' });

  const body = {};
  if (context_uri) body.context_uri = context_uri;
  if (Array.isArray(uris)) body.uris = uris;
  if (offset !== undefined) body.offset = offset;

  try {
    await spotifyFetch(token, `${SPOTIFY_API}/me/player/play?device_id=${encodeURIComponent(device_id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Play error', err);
    res.status(err.status || 500).json({ error: err.message || 'server_error' });
  }
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/login') || req.path.startsWith('/callback') || req.path.startsWith('/refresh_token')) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Try multiple possible locations for index.html
    // Use the same distPath logic as above
    const possibleIndexPaths = [
      path.resolve(process.cwd(), '..', 'dist', 'index.html'),  // Go up from cwd
      path.resolve(__dirname, '..', 'dist', 'index.html'),       // Go up from __dirname
      path.resolve(process.cwd(), 'dist', 'index.html'),        // Direct from cwd
      path.resolve(__dirname, 'dist', 'index.html'),             // Direct from __dirname
      '/opt/render/project/dist/index.html',                     // Absolute path
      path.join(process.cwd(), '..', 'dist', 'index.html')       // Alternative
    ];
    
    let indexPath = null;
    for (const possiblePath of possibleIndexPaths) {
      if (fs.existsSync(possiblePath)) {
        indexPath = possiblePath;
        console.log('✓ Found index.html at:', indexPath);
        break;
      }
    }
    
    if (!indexPath) {
      console.error('ERROR: Could not find index.html. Tried:', possibleIndexPaths);
      return res.status(500).json({ 
        error: 'Build files not found. Please ensure the build completed successfully.',
        tried: possibleIndexPaths,
        cwd: process.cwd(),
        dirname: __dirname
      });
    }
    
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Failed to serve index.html', path: indexPath });
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Current working directory:', process.cwd());
  console.log('__dirname:', __dirname);
  
  if (process.env.NODE_ENV === 'production') {
    // Render runs from src/ directory, so we need to go up one level to find dist/
    const distPath = path.resolve(__dirname, '..', 'dist');
    const indexPath = path.resolve(__dirname, '..', 'dist', 'index.html');
    console.log('Serving static files from:', distPath);
    console.log('Index.html path:', indexPath);
    
    // Check if dist folder exists
    if (!fs.existsSync(distPath)) {
      console.error('ERROR: dist folder does not exist at:', distPath);
    } else {
      console.log('✓ dist folder exists');
      if (!fs.existsSync(indexPath)) {
        console.error('ERROR: index.html does not exist at:', indexPath);
      } else {
        console.log('✓ index.html exists');
      }
    }
  }
});

