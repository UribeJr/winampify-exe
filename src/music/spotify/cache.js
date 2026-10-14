// Small in-memory cache for Spotify reads: one promise per key, kept for `ttlMs`. Callers asking
// for the same key while it loads share the request; failures are not kept, so the next ask retries.
export function createCache({ now = Date.now } = {}) {
  const entries = new Map(); // key → { promise, expires }

  return {
    get(key, ttlMs, load) {
      const hit = entries.get(key);
      if (hit && hit.expires > now()) return hit.promise;
      const promise = Promise.resolve().then(load);
      entries.set(key, { promise, expires: now() + ttlMs });
      promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
      });
      return promise;
    },

    // Drop every key starting with `prefix` (all keys when omitted)
    invalidate(prefix = '') {
      for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
    }
  };
}

export const HOUR = 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
