import React, { memo } from 'react';
import { artistNames, formatTime, trackArt } from './utils';

const COLUMNS = [
  { field: null, label: '#', className: 'col-index' },
  { field: 'title', label: 'Title' },
  { field: 'artist', label: 'Artist' },
  { field: 'album', label: 'Album', album: true },
  { field: 'year', label: 'Year', dates: true, className: 'col-year' },
  { field: 'added', label: 'Added', dates: true, className: 'col-added' },
  { field: 'length', label: 'Length', className: 'col-length' }
];

const formatAdded = (iso) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
};

const Heart = ({ track, starred, onToggle }) => {
  if (!onToggle) return starred ? <span className="track-heart" title="In Liked Songs">♥</span> : null;
  return (
    <button
      type="button"
      className={`track-heart-btn ${starred ? 'on' : ''}`}
      aria-pressed={starred}
      aria-label={starred ? `Remove ${track.title} from Liked Songs` : `Save ${track.title} to Liked Songs`}
      title={starred ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
      onClick={(e) => { e.stopPropagation(); onToggle(track); }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {starred ? '♥' : '♡'}
    </button>
  );
};

/**
 * Track list. Desktop renders WMP's column table; phones get two-line rows with art.
 * Clicking a row (or Enter/Space on it) plays it. Tracks are app models (src/music/models.js).
 * Optional: `onToggleStar` makes the heart a button; `sort` + `onSort` make the headers sortable;
 * `showDates` adds Year and Added columns.
 */
const TrackTable = ({
  tracks, currentKey, onPlay, compact, loading, error, hasMore, onLoadMore, showAlbum = true,
  isStarred, onToggleStar, sort, onSort, showDates = false, emptyText = 'No tracks here yet.'
}) => {
  if (error) return <div className="wmp-library-placeholder">{error}</div>;
  if (!loading && tracks.length === 0) return <div className="wmp-library-placeholder">{emptyText}</div>;

  const columns = COLUMNS.filter((col) => (showAlbum || !col.album) && (showDates || !col.dates));
  const classes = ['track-table', compact && 'compact', !showAlbum && 'no-album', showDates && 'has-dates'].filter(Boolean).join(' ');

  return (
    <div className={classes} role="table" aria-label="Tracks">
      {!compact && (
        <div className="track-table-header" role="row">
          {columns.map((col) => {
            const active = sort?.field && sort.field === col.field;
            const arrow = active ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';
            return (
              <span
                key={col.label}
                role="columnheader"
                className={col.className}
                aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}
              >
                {onSort && col.field
                  ? <button type="button" className="track-sort" onClick={() => onSort(col.field)}>{col.label}{arrow}</button>
                  : col.label}
              </span>
            );
          })}
        </div>
      )}
      <div className="track-table-body" role="rowgroup">
        {tracks.map((track, index) => {
          const isCurrent = track.key === currentKey;
          const unplayable = track.playable === false;
          const heart = isStarred ? <Heart track={track} starred={isStarred(track)} onToggle={onToggleStar} /> : null;
          const play = () => { if (!unplayable) onPlay(track, index); };
          return (
            <div
              role="row"
              tabIndex={unplayable ? -1 : 0}
              key={`${track.key}-${index}`}
              className={`track-table-row ${isCurrent ? 'current' : ''} ${unplayable ? 'unplayable' : ''}`}
              onClick={play}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  play();
                }
              }}
              aria-disabled={unplayable || undefined}
              aria-current={isCurrent || undefined}
              title={unplayable ? 'This track can\'t be played' : `Play ${track.title}`}
            >
              {compact ? (
                <>
                  {trackArt(track, 64)
                    ? <img className="track-row-art" src={trackArt(track, 64)} alt="" loading="lazy" />
                    : <span className="track-row-art placeholder" aria-hidden="true" />}
                  <span className="track-row-text" role="cell">
                    <span className="track-row-title">{isCurrent && '▶ '}{track.title}</span>
                    <span className="track-row-sub">{heart}{artistNames(track)}</span>
                  </span>
                  <span className="col-length" role="cell">{formatTime(track.durationMs)}</span>
                </>
              ) : (
                <>
                  <span className="col-index" role="cell">{isCurrent ? '▶' : index + 1}</span>
                  <span className="col-title" role="cell">{heart}{track.title}</span>
                  <span className="col-artist" role="cell">{artistNames(track)}</span>
                  {showAlbum && <span className="col-album" role="cell">{track.album?.name || ''}</span>}
                  {showDates && <span className="col-year" role="cell">{track.year || ''}</span>}
                  {showDates && <span className="col-added" role="cell">{formatAdded(track.addedAt)}</span>}
                  <span className="col-length" role="cell">{formatTime(track.durationMs)}</span>
                </>
              )}
            </div>
          );
        })}
        {loading && <div className="wmp-library-placeholder">Loading…</div>}
        {hasMore && !loading && (
          <div className="track-table-more">
            <button type="button" onClick={onLoadMore}>Load more</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TrackTable);
