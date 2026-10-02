import { useState, useEffect, useCallback, useRef } from 'react';
import { sourceKey } from './utils';

const EMPTY = { tracks: [], total: 0, hasMore: false, loading: false, error: null };

// Artist sources show albums, not a track list
const hasTracks = (source) => source && source.type !== 'artist';

/**
 * Tracks for the selected library source via the active provider's library.getTracks(source, offset),
 * paged with loadMore(). Lists are cached per source while the player window is open; bumping
 * `version` (e.g. after a favorite changes) drops the cache.
 */
export default function useTrackList(library, source, version = 0) {
  const cacheRef = useRef(new Map());
  const key = sourceKey(source);
  const [state, setState] = useState(EMPTY);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    cacheRef.current.clear();
  }, [library, version]);

  useEffect(() => {
    if (!hasTracks(source)) {
      setState(EMPTY);
      return;
    }
    const cached = cacheRef.current.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    setState({ ...EMPTY, loading: true });
    library.getTracks(source, 0)
      .then((page) => {
        const next = { ...page, loading: false, error: null };
        cacheRef.current.set(key, next);
        if (keyRef.current === key) setState(next);
      })
      .catch((err) => {
        console.error('Failed to load tracks', err);
        if (keyRef.current === key) setState({ ...EMPTY, error: err.message || 'Couldn\'t load these tracks.' });
      });
    // `source` is intentionally omitted: `key` captures its identity
  }, [library, key, version]);

  const loadMore = useCallback(async () => {
    if (!hasTracks(source) || state.loading || !state.hasMore) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await library.getTracks(source, state.tracks.length);
      const next = {
        tracks: [...state.tracks, ...page.tracks],
        total: page.total,
        hasMore: page.hasMore,
        loading: false,
        error: null
      };
      cacheRef.current.set(key, next);
      if (keyRef.current === key) setState(next);
    } catch (err) {
      console.error('Failed to load more tracks', err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, [library, key, source, state]);

  return { ...state, loadMore };
}
