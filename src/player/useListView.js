import { useState, useEffect, useMemo, useCallback } from 'react';
import { filterTracks, sortTracks, filterAlbums, sortAlbums, byDecade } from '../music/selectors';

const RENDER_STEP = 300; // rows drawn at a time; "Show more" draws the next batch

// Newest-first is the natural reading of dates; everything else starts A→Z / shortest
const firstDir = (field) => (field === 'added' || field === 'year' ? 'desc' : 'asc');

// Column clicks cycle: first direction → the other → original order
export function useSortState(resetKey) {
  const [sort, setSort] = useState({ field: null, dir: 'asc' });
  useEffect(() => setSort({ field: null, dir: 'asc' }), [resetKey]);
  const onSort = useCallback((field) => setSort((s) => {
    if (s.field !== field) return { field, dir: firstDir(field) };
    if (s.dir === firstDir(field)) return { field, dir: firstDir(field) === 'asc' ? 'desc' : 'asc' };
    return { field: null, dir: 'asc' };
  }), []);
  return [sort, onSort, setSort];
}

/**
 * Filter + sort for a loaded track list, drawn in batches so thousands of songs stay quick.
 * Everything resets when `resetKey` (the source) changes.
 */
export function useTrackView(tracks, resetKey) {
  const [query, setQuery] = useState('');
  const [sort, onSort] = useSortState(resetKey);
  const [shown, setShown] = useState(RENDER_STEP);
  useEffect(() => setQuery(''), [resetKey]);
  useEffect(() => setShown(RENDER_STEP), [resetKey, query, sort]);

  const list = useMemo(() => sortTracks(filterTracks(tracks, query), sort.field, sort.dir), [tracks, query, sort]);
  const visible = useMemo(() => list.slice(0, shown), [list, shown]);
  const showMore = useCallback(() => setShown((n) => n + RENDER_STEP), []);

  return { query, setQuery, sort, onSort, list, visible, hasMoreRows: list.length > shown, showMore, changed: Boolean(query.trim() || sort.field) };
}

// The album shelf: filter, decade, sort
export function useAlbumView(albums, resetKey) {
  const [query, setQuery] = useState('');
  const [decade, setDecade] = useState(null);
  const [sort, setSort] = useState('');
  useEffect(() => {
    setQuery('');
    setDecade(null);
    setSort('');
  }, [resetKey]);

  const list = useMemo(() => {
    const filtered = byDecade(filterAlbums(albums, query), decade);
    return sort ? sortAlbums(filtered, sort, firstDir(sort)) : filtered;
  }, [albums, query, decade, sort]);

  return { query, setQuery, decade, setDecade, sort, setSort, list };
}
