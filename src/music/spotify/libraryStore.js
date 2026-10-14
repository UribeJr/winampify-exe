// A local index of your Spotify library (saved songs, saved albums, followed artists), kept in
// IndexedDB per Spotify user so the library opens instantly and sorting, filtering and favorites
// need no API calls. The first sync reads everything; later syncs read newest-first only until
// they reach what's already indexed. Holds library data only, never tokens.

const VERSION = 1;
const PAGE = 50;
const FRESH_MS = 15 * 60 * 1000; // a sync within this window is skipped unless forced
const PAGE_PAUSE_MS = 120; // spread a big first sync out to stay well under Spotify's rate limit
export const LIMITS = { tracks: 10000, albums: 2000, artists: 1000 };

const emptyData = () => ({ tracks: [], albums: [], artists: [], syncedAt: 0, complete: false });
const keyFor = (userId) => `spotify:${userId}`;
const isForbidden = (err) => err?.status === 403;

export function memoryPersist() {
  const map = new Map();
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); }
  };
}

// IndexedDB key/value store, or null where IndexedDB doesn't exist (then the index lives in memory)
export function idbPersist(name = 'winampify-library') {
  if (typeof indexedDB === 'undefined') return null;
  let dbPromise = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(name, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('library');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  const run = (mode, action) => open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('library', mode);
    const req = action(tx.objectStore('library'));
    tx.oncomplete = () => resolve(req.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
  return {
    get: (key) => run('readonly', (store) => store.get(key)),
    set: (key, value) => run('readwrite', (store) => store.put(value, key)),
    delete: (key) => run('readwrite', (store) => store.delete(key))
  };
}

/**
 * Reads a saved-items list (newest first) and merges it with what's indexed.
 * Stops at the first item already indexed with the same saved date. Returns the full list, or
 * null when the count doesn't add up (something older was removed): the caller then reads it all.
 */
export async function syncSaved({ fetchPage, toItem, existing, limit, onCount = () => {}, pause = async () => {} }) {
  const known = new Map(existing.map((item) => [item.uri, item.addedAt]));
  const fresh = [];
  const freshUris = new Set();
  let total = 0;
  let reachedKnown = false;
  for (let offset = 0; offset < limit; offset += PAGE) {
    const page = await fetchPage(offset);
    total = Math.min(page.total ?? 0, limit);
    for (const item of (page.items || []).map(toItem)) {
      if (!item?.uri || freshUris.has(item.uri)) continue;
      if (known.has(item.uri) && known.get(item.uri) === item.addedAt) {
        reachedKnown = true;
        break;
      }
      fresh.push(item);
      freshUris.add(item.uri);
    }
    onCount(reachedKnown ? total : fresh.length, total);
    if (reachedKnown || !page.next) break;
    await pause();
  }
  if (!reachedKnown) return fresh.slice(0, limit);
  const merged = [...fresh, ...existing.filter((item) => !freshUris.has(item.uri))].slice(0, limit);
  return merged.length === total ? merged : null;
}

/**
 * `api`: the proxy client (src/spotify/api.js). `normalize`: { savedTrack, savedAlbum, artist }
 * turning Spotify objects into app models (savedTrack/savedAlbum get `addedAt`).
 */
export function createLibraryStore({
  api,
  normalize,
  persist = memoryPersist(),
  now = Date.now,
  pause = () => new Promise((resolve) => setTimeout(resolve, PAGE_PAUSE_MS))
}) {
  let userId = null;
  let data = emptyData();
  let uris = new Set();
  let status = { state: 'idle' };
  let syncing = null;
  const listeners = new Set();

  const setStatus = (next) => {
    status = next;
    listeners.forEach((fn) => fn(status));
  };
  const counts = () => ({ songs: data.tracks.length, albums: data.albums.length, artists: data.artists.length });
  const reindex = () => {
    uris = new Set([...data.tracks, ...data.albums].map((item) => item.uri));
  };
  const save = async () => {
    if (!userId) return;
    try {
      await persist.set(keyFor(userId), { version: VERSION, ...data });
    } catch (err) {
      console.warn('Library index not saved (kept for this visit only)', err);
    }
  };

  const readArtists = async () => {
    const artists = [];
    let after;
    try {
      while (artists.length < LIMITS.artists) {
        const page = (await api.getFollowedArtists(after)).artists || {};
        artists.push(...(page.items || []).filter(Boolean).map(normalize.artist));
        after = page.cursors?.after;
        if (!page.next || !after) break;
        await pause();
      }
    } catch (err) {
      if (!isForbidden(err)) throw err; // missing permission until the next sign-in: no followed artists
    }
    return artists;
  };

  const readSaved = async (phase, fetchPage, toItem, existing, limit) => {
    const run = (list) => syncSaved({
      fetchPage,
      toItem,
      existing: list,
      limit,
      pause,
      onCount: (done, total) => setStatus({ state: 'syncing', phase, done, total })
    });
    return (await run(existing)) ?? run([]);
  };

  return {
    // Load this user's saved index (if any). Switching users drops the previous one from memory.
    async open(id) {
      if (!id || id === userId) return;
      userId = id;
      data = emptyData();
      try {
        const saved = await persist.get(keyFor(id));
        if (saved?.version === VERSION && userId === id) {
          data = { ...emptyData(), ...saved };
          delete data.version;
        }
      } catch (err) {
        console.warn('Library index unavailable; it will be rebuilt', err);
      }
      reindex();
      setStatus(data.complete ? { state: 'ready', ...counts() } : { state: 'idle' });
    },

    get ready() {
      return data.complete;
    },

    getStatus: () => status,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Bring the index up to date. Skipped if it was synced in the last 15 minutes (unless forced).
    sync({ force = false } = {}) {
      if (!userId) return Promise.resolve(false);
      if (syncing) return syncing;
      if (!force && data.complete && now() - data.syncedAt < FRESH_MS) return Promise.resolve(false);
      const id = userId;
      syncing = (async () => {
        try {
          setStatus({ state: 'syncing', phase: 'songs', done: 0, total: 0 });
          const tracks = await readSaved('songs', (offset) => api.getLikedTracks(offset, PAGE), normalize.savedTrack, data.tracks, LIMITS.tracks);
          setStatus({ state: 'syncing', phase: 'albums', done: 0, total: 0 });
          const albums = await readSaved('albums', (offset) => api.getSavedAlbums(offset, PAGE), normalize.savedAlbum, data.albums, LIMITS.albums);
          setStatus({ state: 'syncing', phase: 'artists', done: 0, total: 0 });
          const artists = await readArtists();
          if (userId !== id) return false; // signed out meanwhile
          data = { tracks, albums, artists, syncedAt: now(), complete: true };
          reindex();
          await save();
          setStatus({ state: 'ready', ...counts() });
          return true;
        } catch (err) {
          if (userId === id) {
            console.error('Library sync failed', err);
            setStatus(data.complete ? { state: 'ready', ...counts(), stale: true } : { state: 'error', status: err?.status ?? null });
          }
          return false;
        } finally {
          syncing = null;
        }
      })();
      return syncing;
    },

    getAll: (kind) => data[kind] || [],
    has: (uri) => uris.has(uri),

    // Keep the index in step with a save/remove made in the app
    add(kind, item) {
      if (!item?.uri || !data[kind]) return;
      data = { ...data, [kind]: [item, ...data[kind].filter((x) => x.uri !== item.uri)] };
      reindex();
      if (status.state === 'ready') setStatus({ state: 'ready', ...counts() });
      save();
    },
    remove(kind, uri) {
      if (!data[kind]) return;
      data = { ...data, [kind]: data[kind].filter((x) => x.uri !== uri) };
      reindex();
      if (status.state === 'ready') setStatus({ state: 'ready', ...counts() });
      save();
    },

    // Sign-out: forget this user's index here and on disk
    async clear() {
      const id = userId;
      userId = null;
      data = emptyData();
      reindex();
      setStatus({ state: 'idle' });
      if (id) {
        try {
          await persist.delete(keyFor(id));
        } catch { /* storage blocked: nothing was saved */ }
      }
    }
  };
}
