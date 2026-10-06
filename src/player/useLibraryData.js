import { useState, useEffect } from 'react';

// Runs `load()` when `deps` change, returning { data, loading, error }. Stale results are dropped.
function useLoader(load, deps, initial) {
  const [state, setState] = useState({ data: initial, loading: false, error: null });

  useEffect(() => {
    if (!load) {
      setState({ data: initial, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((err) => {
        console.error('Library request failed', err);
        if (!cancelled) setState({ data: initial, loading: false, error: err.message || 'Request failed' });
      });
    return () => { cancelled = true; };
    // `load` is rebuilt each render; `deps` decide when to refetch
  }, deps);

  return state;
}

const EMPTY_LIST = [];
const EMPTY_SEARCH = { artists: [], albums: [], playlists: [] };
const EMPTY_HOME = { sections: [], needsReauth: false };

/**
 * Library collections for the Media Library views: albums, artists, and the dashboard's
 * "Recently Added" / "Recently Played" rows (only when the provider supports them).
 */
export function useLibraryCollections(library, enabled) {
  const { capabilities } = library;
  const albums = useLoader(enabled ? () => library.getAlbums() : null, [library, enabled], EMPTY_LIST);
  const artists = useLoader(enabled && capabilities.artists ? () => library.getArtists() : null, [library, enabled], EMPTY_LIST);
  const newest = useLoader(enabled && capabilities.recentAlbums ? () => library.getAlbumList('newest', 12) : null, [library, enabled], EMPTY_LIST);
  const recent = useLoader(enabled && capabilities.recentAlbums ? () => library.getAlbumList('recent', 12) : null, [library, enabled], EMPTY_LIST);

  return {
    albums: albums.data,
    artists: artists.data,
    newest: newest.data,
    recent: recent.data,
    loading: albums.loading || artists.loading
  };
}

// Artist page: the artist plus their albums
export function useArtistDetail(library, source) {
  const id = source?.type === 'artist' ? source.id : null;
  const state = useLoader(id ? () => library.getArtist(id) : null, [library, id], null);
  return { artist: state.data?.artist || null, albums: state.data?.albums || EMPTY_LIST, loading: state.loading, error: state.error };
}

// Artist and album matches for a search source (songs come from the track list)
export function useSearchExtras(library, source) {
  const query = source?.type === 'search' ? source.query : null;
  const state = useLoader(
    query && library.search ? () => library.search(query, { songCount: 0 }) : null,
    [library, query],
    EMPTY_SEARCH
  );
  return {
    artists: state.data.artists || EMPTY_LIST,
    albums: state.data.albums || EMPTY_LIST,
    playlists: state.data.playlists || EMPTY_LIST,
    loading: state.loading
  };
}

// Provider-specific dashboard rows (Spotify: top artists, "made from your listening")
export function useLibraryHome(library, enabled) {
  const state = useLoader(enabled && library.getHome ? () => library.getHome() : null, [library, enabled], EMPTY_HOME);
  return state.data || EMPTY_HOME;
}
