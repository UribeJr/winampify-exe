import React, { useRef, useEffect, useState } from 'react';
import { artistNames, formatTime } from './utils';
import { useMusic } from '../music/MusicContext';

// Desktop-only side pane for Now Playing / Visualizer, like WMP 7's playlist pane:
// the queue in play order, current track highlighted, click a track to jump to it.
const QueuePane = ({ onClose }) => {
  const { playback, controls, providerName, library } = useMusic();
  const { upcoming, queueCursor, queueSource, track } = playback;
  const listRef = useRef(null);
  const hasQueue = Array.isArray(upcoming) && upcoming.length > 0;

  // Spotify: the queue lives on Spotify's side; fetch it (read-only) when the pane opens and per track
  const remote = !Array.isArray(upcoming) && typeof library?.getQueue === 'function';
  const [remoteQueue, setRemoteQueue] = useState(null);
  const [skipping, setSkipping] = useState(false);
  const canSkip = remote && typeof controls.skipAhead === 'function';
  const skipTo = async (count) => {
    if (skipping) return;
    setSkipping(true);
    try {
      await controls.skipAhead(count);
    } catch (err) {
      console.error('Skip failed', err);
    } finally {
      setSkipping(false);
    }
  };
  useEffect(() => {
    if (!remote) return undefined;
    let cancelled = false;
    library.getQueue()
      .then((q) => { if (!cancelled) setRemoteQueue(q); })
      .catch(() => { if (!cancelled) setRemoteQueue({ current: null, upcoming: [], failed: true }); });
    return () => { cancelled = true; };
  }, [remote, library, track?.key]);

  // Keep the current track in view as the queue advances
  useEffect(() => {
    listRef.current?.querySelector('.queue-item.current')?.scrollIntoView({ block: 'nearest' });
  }, [queueCursor, hasQueue]);

  let body;
  if (remote) {
    const current = remoteQueue?.current || track;
    body = !remoteQueue ? (
      <p className="queue-empty">Loading…</p>
    ) : !current && !remoteQueue.upcoming.length ? (
      <p className="queue-empty">{remoteQueue.failed ? `Couldn't load the ${providerName} queue.` : 'Nothing playing yet.'}</p>
    ) : (
      <ol className="queue-list" ref={listRef}>
        {current && (
          <li>
            <div className="queue-item current" aria-current="true">
              <span className="queue-num">▶</span>
              <span className="queue-text">
                <span className="queue-title">{current.title}</span>
                <span className="queue-artist">{artistNames(current)}</span>
              </span>
              <span className="queue-time">{current.durationMs ? formatTime(current.durationMs) : ''}</span>
            </div>
          </li>
        )}
        {remoteQueue.upcoming.length > 0 && <li className="queue-heading">Up Next</li>}
        {remoteQueue.upcoming.map((t, i) => {
          const inner = (
            <>
              <span className="queue-num">{i + 1}</span>
              <span className="queue-text">
                <span className="queue-title">{t.title}</span>
                <span className="queue-artist">{artistNames(t)}</span>
              </span>
              <span className="queue-time">{t.durationMs ? formatTime(t.durationMs) : ''}</span>
            </>
          );
          return (
            <li key={`${t.key}-${i}`}>
              {canSkip ? (
                <button type="button" className="queue-item" onClick={() => skipTo(i + 1)} disabled={skipping} title={`Play ${t.title}`}>
                  {inner}
                </button>
              ) : <div className="queue-item">{inner}</div>}
            </li>
          );
        })}
      </ol>
    );
  } else if (!Array.isArray(upcoming)) {
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
      {remote && (
        <div className="queue-summary">
          <b>Playing on {providerName}</b>
          <span>{remoteQueue?.upcoming.length ? `${remoteQueue.upcoming.length} up next` : 'Up next'}</span>
        </div>
      )}
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
