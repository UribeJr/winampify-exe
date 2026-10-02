import React from 'react';
import TrackTable from './TrackTable';
import { useMusic } from '../music/MusicContext';

// Full-width track table for the selected source (WMP's "Playlist" view).
const PlaylistView = ({ source, trackList, currentKey, onPlayTrack, onPlayAll, onOpenLibrary, isMobile }) => {
  const { capabilities, isStarred } = useMusic();
  if (!source) {
    return (
      <div className="wmp-playlist-view">
        <div className="wmp-library-placeholder">
          <p>No playlist selected.</p>
          <button type="button" onClick={onOpenLibrary}>Open Media Library</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wmp-playlist-view">
      <div className="wmp-playlist-header">
        <h3>{source.name}</h3>
        <span className="library-source-meta">{trackList.total ? `${trackList.total} songs` : ''}</span>
        <button type="button" className="library-play-all" onClick={onPlayAll}>▶ Play all</button>
      </div>
      <TrackTable
        tracks={trackList.tracks}
        currentKey={currentKey}
        isStarred={capabilities.star ? isStarred : undefined}
        onPlay={onPlayTrack}
        compact={isMobile}
        loading={trackList.loading}
        error={trackList.error}
        hasMore={trackList.hasMore}
        onLoadMore={trackList.loadMore}
        showAlbum={source.type !== 'album'}
      />
    </div>
  );
};

export default PlaylistView;
