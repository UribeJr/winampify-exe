import React, { useState, useRef, useEffect } from 'react';
import StartMenu from './StartMenu';
import useClock from '../hooks/useClock';
import { useSpotify } from '../spotify/SpotifyContext';

const VolumePopup = ({ onClose }) => {
  const { playback, controls } = useSpotify();
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.tray-icon-volume')) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  return (
    <div className="tray-volume-popup window" ref={ref} role="dialog" aria-label="Volume">
      <div className="tray-volume-body">
        <span className="tray-volume-label">Volume</span>
        <input
          type="range"
          className="tray-volume-slider"
          min="0"
          max="1"
          step="0.01"
          value={playback.volume}
          disabled={!playback.canSetVolume}
          onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
        />
        <div className="field-row">
          <input
            id="tray-mute"
            type="checkbox"
            checked={playback.volume === 0}
            disabled={!playback.canSetVolume}
            onChange={controls.toggleMute}
          />
          <label htmlFor="tray-mute">Mute</label>
        </div>
      </div>
    </div>
  );
};

const Taskbar = ({ windows, activeId, onToggleWindow, onMenuAction }) => {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const time = useClock();
  const { isAuthenticated } = useSpotify();

  return (
    <>
      <div className="win98-taskbar">
        <button
          type="button"
          className={`taskbar-start ${startMenuOpen ? 'active' : ''}`}
          onClick={() => setStartMenuOpen((open) => !open)}
          aria-expanded={startMenuOpen}
        >
          <span className="start-logo" aria-hidden="true" />
          <span className="start-text">Start</span>
        </button>
        <div className="taskbar-apps">
          {windows.map((win) => (
            <button
              type="button"
              key={win.id}
              className={`taskbar-app ${activeId === win.id && !win.isMinimized ? 'active' : ''}`}
              onClick={() => onToggleWindow(win.id)}
              title={win.title}
            >
              <span className={`app-icon icon-${win.icon}`} aria-hidden="true" />
              <span className="app-text">{win.title}</span>
            </button>
          ))}
        </div>
        <div className="taskbar-tray">
          {isAuthenticated && (
            <button
              type="button"
              className="tray-icon tray-icon-volume"
              title="Volume"
              aria-label="Volume"
              onClick={() => setVolumeOpen((open) => !open)}
            />
          )}
          <div className="tray-time">{time}</div>
        </div>
      </div>
      {volumeOpen && <VolumePopup onClose={() => setVolumeOpen(false)} />}
      <StartMenu
        isOpen={startMenuOpen}
        onClose={() => setStartMenuOpen(false)}
        onMenuAction={onMenuAction}
      />
    </>
  );
};

export default Taskbar;
