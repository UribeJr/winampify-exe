import React from 'react';
import SeekBar from './SeekBar';
import usePlaybackPosition from './usePlaybackPosition';
import { artistNames, trackArt } from './utils';
import { useMusic } from '../music/MusicContext';

// Desktop-only side pane showing the current track next to the library/playlist views.
const NowPlayingPane = ({ onClose }) => {
  const { playback, controls } = useMusic();
  const position = usePlaybackPosition(playback);
  const { track, isActive, duration } = playback;
  const art = trackArt(track, 200);

  return (
    <aside className="wmp-now-playing-pane" aria-label="Now Playing">
      <div className="wmp-now-playing-pane-header">
        <span>Now Playing</span>
        <button type="button" className="pane-close" onClick={onClose} aria-label="Hide Now Playing pane">×</button>
      </div>
      <div className="wmp-now-playing-pane-content">
        <div className="wmp-now-playing-pane-artwork">
          {art ? (
            <img src={art} alt="" className="wmp-now-playing-pane-image" />
          ) : (
            <div className="wmp-now-playing-pane-placeholder"><span className="icon-cd-large" /></div>
          )}
        </div>
        <div className="wmp-now-playing-pane-info">
          <h3 className="wmp-now-playing-pane-title">{track?.title || 'No track playing'}</h3>
          <p className="wmp-now-playing-pane-artist">{track ? artistNames(track) : 'Select a track to play'}</p>
          {track?.album?.name && <p className="wmp-now-playing-pane-album">{track.album.name}</p>}
        </div>
        <SeekBar variant="pane" position={position} duration={duration} onSeek={controls.seek} disabled={!isActive} showTimes />
      </div>
    </aside>
  );
};

export default NowPlayingPane;
