import React, { useRef, useEffect } from 'react';
import { artistNames, formatTime } from './utils';
import { useMusic } from '../music/MusicContext';

// Desktop-only side pane for Now Playing / Visualizer, like WMP 7's playlist pane:
// the queue in play order, current track highlighted, click a track to jump to it.
const QueuePane = ({ onClose }) => {
  const { playback, controls, providerName } = useMusic();
  const { upcoming, queueCursor, queueSource, track } = playback;
  const listRef = useRef(null);
  const hasQueue = Array.isArray(upcoming) && upcoming.length > 0;

  // Keep the current track in view as the queue advances
  useEffect(() => {
    listRef.current?.querySelector('.queue-item.current')?.scrollIntoView({ block: 'nearest' });
  }, [queueCursor, hasQueue]);

  let body;
  if (!Array.isArray(upcoming)) {
    body = (
      <p className="queue-empty">
        {track ? `Playing from ${providerName}. The up-next list lives in the ${providerName} app.` : 'Nothing playing yet.'}
      </p>
    );
  } else if (!hasQueue) {
    body = <p className="queue-empty">The playlist is empty. Play an album, playlist or song from the Media Library.</p>;
  } else {
    body = (
      <ol className="queue-list" ref={listRef}>
        {upcoming.map((t, i) => (
          <li key={`${t.key || t.id}-${i}`}>
            <button
              type="button"
              className={`queue-item ${i === queueCursor ? 'current' : ''} ${i < queueCursor ? 'played' : ''}`}
              onClick={() => controls.jumpTo(i)}
              aria-current={i === queueCursor ? 'true' : undefined}
              title={`Play ${t.title}`}
            >
              <span className="queue-num">{i === queueCursor ? '▶' : i + 1}</span>
              <span className="queue-text">
                <span className="queue-title">{t.title}</span>
                <span className="queue-artist">{artistNames(t)}</span>
              </span>
              <span className="queue-time">{t.durationMs ? formatTime(t.durationMs) : ''}</span>
            </button>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <aside className="wmp-now-playing-pane queue-pane" aria-label="Playlist">
      <div className="wmp-now-playing-pane-header">
        <span>Playlist</span>
        <button type="button" className="pane-close" onClick={onClose} aria-label="Hide Playlist pane">×</button>
      </div>
      {hasQueue && (
        <div className="queue-summary">
          <b>{queueSource?.name || 'Now Playing'}</b>
          <span>{queueCursor + 1} of {upcoming.length}{playback.shuffle ? ' · Shuffle' : ''}</span>
        </div>
      )}
      {body}
    </aside>
  );
};

export default QueuePane;
