import { useState, useEffect, useCallback, useRef } from 'react';
import { sourceKey } from './utils';

const PAGE_SIZE = { playlist: 100, liked: 50 };

const fromItems = (items = []) =>
  items.map((item) => item?.track).filter((track) => track && track.uri);

async function fetchPage(api, source, offset) {
  if (source.type === 'playlist') {
    const page = await api.getPlaylistTracks(source.id, offset, PAGE_SIZE.playlist);
    return { tracks: fromItems(page.items), total: page.total ?? 0, hasMore: Boolean(page.next) };
  }
  if (source.type === 'liked') {
    const page = await api.getLikedTracks(offset, PAGE_SIZE.liked);
    return { tracks: fromItems(page.items), total: page.total ?? 0, hasMore: Boolean(page.next) };
  }
  if (source.type === 'album') {
    // Album tracks come back without their album; re-attach it so art and names render
    const album = await api.getAlbum(source.id);
    const albumInfo = { name: album.name, images: album.images, uri: album.uri, id: album.id };
    const tracks = (album.tracks?.items || []).map((t) => ({ ...t, album: albumInfo }));
    return { tracks, total: album.tracks?.total ?? tracks.length, hasMore: false };
  }
  return { tracks: [], total: 0, hasMore: false };
}

const EMPTY = { tracks: [], total: 0, hasMore: false, loading: false, error: null };

/**
 * Tracks for the selected library source (playlist, liked songs or album), paged with loadMore().
 * Lists are cached per source for as long as the player window is open.
 */
export default function useTrackList(api, source) {
  const cacheRef = useRef(new Map());
  const key = sourceKey(source);
  const [state, setState] = useState(EMPTY);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!source) {
      setState(EMPTY);
      return;
    }
    const cached = cacheRef.current.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    setState({ ...EMPTY, loading: true });
    fetchPage(api, source, 0)
      .then((page) => {
        const next = { ...page, loading: false, error: null };
        cacheRef.current.set(key, next);
        if (keyRef.current === key) setState(next);
      })
      .catch((err) => {
        console.error('Failed to load tracks', err);
        if (keyRef.current === key) setState({ ...EMPTY, error: 'Couldn\'t load these tracks.' });
      });
    // `source` is intentionally omitted: `key` captures its identity
  }, [api, key]);

  const loadMore = useCallback(async () => {
    if (!source || state.loading || !state.hasMore) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await fetchPage(api, source, state.tracks.length);
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
  }, [api, key, source, state]);

  const clearCache = useCallback(() => cacheRef.current.clear(), []);

  return { ...state, loadMore, clearCache };
}
