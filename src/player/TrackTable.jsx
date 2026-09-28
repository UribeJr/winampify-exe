import React, { memo } from 'react';
import { artistNames, formatTime, trackArt } from './utils';

/**
 * Track list. Desktop renders WMP's column table; phones get two-line rows with art.
 * Clicking (tapping) a row plays it.
 */
const TrackTable = ({ tracks, currentUri, onPlay, compact, loading, error, hasMore, onLoadMore, showAlbum = true }) => {
  if (error) return <div className="wmp-library-placeholder">{error}</div>;
  if (!loading && tracks.length === 0) return <div className="wmp-library-placeholder">No tracks here yet.</div>;

  return (
    <div className={`track-table ${compact ? 'compact' : ''} ${showAlbum ? '' : 'no-album'}`}>
      {!compact && (
        <div className="track-table-header">
          <span>#</span>
          <span>Title</span>
          <span>Artist</span>
          {showAlbum && <span>Album</span>}
          <span className="col-length">Length</span>
        </div>
      )}
      <div className="track-table-body">
        {tracks.map((track, index) => {
          const isCurrent = track.uri === currentUri;
          const unplayable = track.is_local || track.is_playable === false;
          return (
            <button
              type="button"
              key={`${track.uri}-${index}`}
              className={`track-table-row ${isCurrent ? 'current' : ''}`}
              onClick={() => onPlay(track, index)}
              disabled={unplayable}
              title={unplayable ? 'This track can\'t be played from Spotify' : `Play ${track.name}`}
            >
              {compact ? (
                <>
                  {trackArt(track, 64)
                    ? <img className="track-row-art" src={trackArt(track, 64)} alt="" loading="lazy" />
                    : <span className="track-row-art placeholder" aria-hidden="true" />}
                  <span className="track-row-text">
                    <span className="track-row-title">{isCurrent && '▶ '}{track.name}</span>
                    <span className="track-row-sub">{artistNames(track)}</span>
                  </span>
                  <span className="col-length">{formatTime(track.duration_ms)}</span>
                </>
              ) : (
                <>
                  <span className="col-index">{isCurrent ? '▶' : index + 1}</span>
                  <span className="col-title">{track.name}</span>
                  <span className="col-artist">{artistNames(track)}</span>
                  {showAlbum && <span className="col-album">{track.album?.name || ''}</span>}
                  <span className="col-length">{formatTime(track.duration_ms)}</span>
                </>
              )}
            </button>
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
