import React, { useState } from 'react';
import SeekBar from './SeekBar';
import usePlaybackPosition from './usePlaybackPosition';
import { useSpotify } from '../spotify/SpotifyContext';

const SEEK_STEP_MS = 10000;
const REPEAT_LABELS = { off: 'Repeat: Off', context: 'Repeat: All', track: 'Repeat: One' };

const ControlButton = ({ icon, title, onClick, disabled, active, large }) => (
  <button
    type="button"
    className={`control-btn ${active ? 'active' : ''} ${large ? 'large' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={active === undefined ? undefined : active}
  >
    <span className={`toolbar-icon toolbar-icon-${icon}`} aria-hidden="true" />
  </button>
);

/**
 * Transport controls. Desktop keeps WMP's single row (with rewind/fast-forward now seeking ±10s);
 * phones get a big centered transport row plus a Devices button and a tap-to-open volume slider.
 */
const ControlBar = ({ isMobile, paneVisible, onTogglePane, onOpenDevices }) => {
  const { playback, controls, mode } = useSpotify();
  const position = usePlaybackPosition(playback);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const { isActive, isPaused, duration, volume, shuffle, repeat, canSetVolume, ready } = playback;
  const noSession = !isActive;

  const playPause = (
    <ControlButton
      icon={isActive && !isPaused ? 'pause' : 'play'}
      title={isActive && !isPaused ? 'Pause' : 'Play'}
      onClick={controls.togglePlay}
      disabled={!ready}
      large={isMobile}
    />
  );
  const shuffleBtn = (
    <ControlButton icon="shuffle" title={shuffle ? 'Shuffle: On' : 'Shuffle: Off'} onClick={controls.toggleShuffle} disabled={noSession} active={shuffle} />
  );
  const repeatBtn = (
    <ControlButton
      icon={repeat === 'track' ? 'repeat-one' : 'repeat'}
      title={REPEAT_LABELS[repeat]}
      onClick={controls.cycleRepeat}
      disabled={noSession}
      active={repeat !== 'off'}
    />
  );
  const volumeControls = (
    <div className="control-volume">
      <ControlButton
        icon={volume === 0 ? 'mute' : 'volume'}
        title={volume === 0 ? 'Unmute' : 'Mute'}
        onClick={isMobile ? () => setVolumeOpen((open) => !open) : controls.toggleMute}
        disabled={!canSetVolume}
      />
      {(!isMobile || volumeOpen) && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
          className="control-volume-slider"
          aria-label="Volume"
          disabled={!canSetVolume}
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="wmp-control-bar mobile">
        <SeekBar position={position} duration={duration} onSeek={controls.seek} disabled={noSession} showTimes />
        <div className="control-bar-transport">
          {shuffleBtn}
          <ControlButton icon="prev" title="Previous Track" onClick={controls.previous} disabled={noSession} large />
          {playPause}
          <ControlButton icon="next" title="Next Track" onClick={controls.next} disabled={noSession} large />
          {repeatBtn}
        </div>
        <div className="control-bar-secondary">
          {mode === 'connect' && (
            <button type="button" className="devices-btn" onClick={onOpenDevices}>
              <span className="toolbar-icon toolbar-icon-devices" aria-hidden="true" />
              {playback.deviceName ? `Playing on ${playback.deviceName}` : 'Devices'}
            </button>
          )}
          {volumeControls}
        </div>
      </div>
    );
  }

  return (
    <div className="wmp-control-bar">
      <div className="control-bar-progress">
        <SeekBar position={position} duration={duration} onSeek={controls.seek} disabled={noSession} />
      </div>
      <div className="control-bar-controls">
        <div className="control-buttons-left">
          {playPause}
          <ControlButton icon="stop" title="Stop" onClick={controls.stop} disabled={noSession} />
          <span className="control-separator" />
          <ControlButton icon="prev" title="Previous Track" onClick={controls.previous} disabled={noSession} />
          <ControlButton icon="rewind" title="Rewind 10 seconds" onClick={() => controls.seek(position - SEEK_STEP_MS)} disabled={noSession} />
          <ControlButton icon="fastforward" title="Fast Forward 10 seconds" onClick={() => controls.seek(position + SEEK_STEP_MS)} disabled={noSession} />
          <ControlButton icon="next" title="Next Track" onClick={controls.next} disabled={noSession} />
          <span className="control-separator" />
          {shuffleBtn}
          {repeatBtn}
        </div>
        <div className="control-buttons-right">
          {mode === 'connect' && (
            <ControlButton icon="devices" title={playback.deviceName ? `Playing on ${playback.deviceName}` : 'Devices'} onClick={onOpenDevices} />
          )}
          <ControlButton icon="playlist" title={paneVisible ? 'Hide Now Playing pane' : 'Show Now Playing pane'} onClick={onTogglePane} active={paneVisible} />
          {volumeControls}
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
