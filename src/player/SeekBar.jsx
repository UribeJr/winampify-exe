import React, { useRef, useState } from 'react';
import { formatTime } from './utils';

/**
 * Clickable + draggable progress bar (pointer events cover mouse and touch).
 * While dragging it shows the preview position and seeks once on release.
 */
const SeekBar = ({ position, duration, onSeek, disabled, variant = 'control', showTimes = false }) => {
  const trackRef = useRef(null);
  const [dragPosition, setDragPosition] = useState(null);

  const positionAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fraction * duration;
  };

  const canSeek = !disabled && duration > 0;
  const shown = dragPosition ?? position;
  const percent = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0;

  const onPointerDown = (e) => {
    if (!canSeek) return;
    e.preventDefault();
    trackRef.current.setPointerCapture(e.pointerId);
    setDragPosition(positionAt(e.clientX));
  };
  const onPointerMove = (e) => {
    if (dragPosition === null) return;
    setDragPosition(positionAt(e.clientX));
  };
  const onPointerUp = (e) => {
    if (dragPosition === null) return;
    const target = positionAt(e.clientX);
    setDragPosition(null);
    onSeek(target);
  };
  const onKeyDown = (e) => {
    if (!canSeek) return;
    const step = e.shiftKey ? 30000 : 5000;
    if (e.key === 'ArrowRight') onSeek(Math.min(duration, position + step));
    if (e.key === 'ArrowLeft') onSeek(Math.max(0, position - step));
  };

  return (
    <div className={`seek-bar seek-bar-${variant} ${canSeek ? '' : 'disabled'}`}>
      <div
        ref={trackRef}
        className="seek-track"
        role="slider"
        tabIndex={canSeek ? 0 : -1}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(shown / 1000)}
        aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        aria-disabled={!canSeek}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragPosition(null)}
        onKeyDown={onKeyDown}
      >
        <div className={`seek-fill ${dragPosition !== null ? 'dragging' : ''}`} style={{ width: `${percent}%` }} />
        {canSeek && <div className="seek-thumb" style={{ left: `${percent}%` }} />}
      </div>
      {showTimes && (
        <div className="seek-times">
          <span>{formatTime(shown)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
};

export default SeekBar;
