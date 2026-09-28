import React, { useRef, useCallback, lazy, Suspense } from 'react';
import SeekBar from './SeekBar';
import usePlaybackPosition from './usePlaybackPosition';
import { artistNames, trackArt } from './utils';
import { useSpotify } from '../spotify/SpotifyContext';

const BAR_COUNT = 8;

// butterchurn + presets are ~800 kB; only load them when the visualizer is opened
const Visualizer = lazy(() => import('./Visualizer'));

const NowPlayingView = ({ visualizerOn, visualizerRef, activePreset }) => {
  const { playback, controls, api } = useSpotify();
  const position = usePlaybackPosition(playback);
  const { track, isActive, isPaused, duration } = playback;
  const playing = isActive && !isPaused;

  // The visualizer reads position every frame; keep it off React state
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const getPosition = useCallback(() => {
    const p = playbackRef.current;
    return p.isPaused ? p.position : p.position + (Date.now() - p.updatedAt);
  }, []);

  if (visualizerOn) {
    return (
      <div className="wmp-now-playing-view visualizer-mode">
        <Suspense fallback={<div className="wmp-visualizer-container visualizer-loading">Loading visualization…</div>}>
          <Visualizer
            ref={visualizerRef}
            isActive={playing}
            trackId={track?.type === 'episode' ? null : track?.id}
            getPosition={getPosition}
            api={api}
            initialPreset={activePreset}
          />
        </Suspense>
        {track && (
          <div className="visualizer-caption">
            <b>{track.name}</b> — {artistNames(track)}
          </div>
        )}
      </div>
    );
  }

  const art = trackArt(track, 300);

  return (
    <div className="wmp-now-playing-view">
      <div className="wmp-visualization-area">
        {art ? (
          <img src={art} alt={track.album?.name || track.name} className="wmp-album-art-large" />
        ) : (
          <div className="wmp-album-art-placeholder" aria-hidden="true">
            <span className="icon-cd-large" />
          </div>
        )}
        <div className={`wmp-visualization-bars ${playing ? 'playing' : ''}`} aria-hidden="true">
          {Array.from({ length: BAR_COUNT }, (_, i) => <div className="viz-bar" key={i} />)}
        </div>
      </div>
      <div className="wmp-track-info-large">
        <h2 className="wmp-track-title">{track?.name || 'No track playing'}</h2>
        <p className="wmp-track-artist">{track ? artistNames(track) : 'Pick something from the Media Library'}</p>
        {track?.album?.name && <p className="wmp-track-album">{track.album.name}</p>}
      </div>
      <div className="wmp-progress-area">
        <SeekBar
          variant="large"
          position={position}
          duration={duration}
          onSeek={controls.seek}
          disabled={!isActive}
          showTimes
        />
      </div>
    </div>
  );
};

export default NowPlayingView;
