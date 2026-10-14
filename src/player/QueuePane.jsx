import React, { useRef, useEffect, useState } from 'react';
import { artistNames, formatTime, coverUrl } from './utils';
import { useMusic } from '../music/MusicContext';

const VIEW_KEY = 'winampify-queue-view';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'art';
  } catch {
    return 'art';
  }
};

const Thumb = ({ track }) => {
  const url = coverUrl(track, 64);
  return url
    ? <img className="queue-thumb" src={url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    : <span className="queue-thumb placeholder icon-cd" aria-hidden="true" />;
};

// One queue row's contents: number (or ▶), optional thumbnail, title/artist, length
const RowContent = ({ track, num, art }) => (
  <>
    <span className="queue-num">{num}</span>
    {art && <Thumb track={track} />}
    <span className="queue-text">
      <span className="queue-title">{track.title}</span>
      <span className="queue-artist">{artistNames(track)}</span>
    </span>
    <span className="queue-time">{track.durationMs ? formatTime(track.durationMs) : ''}</span>
  </>
);

// The current song's cover, large, above the list (Art + List view)
const NowCover = ({ track }) => {
  if (!track) return null;
  const url = coverUrl(track, 300);
  return (
    <div className="queue-cover">
      {url
        ? <img src={url} alt={`Cover of ${track.album?.name || track.title}`} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        : <span className="queue-cover-placeholder icon-cd-large" aria-hidden="true" />}
      <span className="queue-cover-title">{track.title}</span>
      <span className="queue-cover-artist">{artistNames(track)}</span>
    </div>
  );
};

// Desktop-only side pane for Now Playing / Visualizer, like WMP 7's playlist pane:
// the queue in play order, current track highlighted, click a track to jump to it.
// The header switches between List and Art + List (remembered per browser).
const QueuePane = ({ onClose }) => {
  const { playback, controls, providerName, library } = useMusic();
  const { upcoming, queueCursor, queueSource, track } = playback;
  const listRef = useRef(null);
  const hasQueue = Array.isArray(upcoming) && upcoming.length > 0;
  const [view, setView] = useState(readView);
  const art = view === 'art';
  const chooseView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked: lasts this visit */ }
  };

  // Spotify: the queue lives on Spotify's side; fetch it when the pane opens and per track
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
  }, [queueCursor, hasQueue, view]);

  let body;
  let current = track;
  if (remote) {
    current = remoteQueue?.current || track;
    body = !remoteQueue ? (
      <p className="queue-empty">Loading…</p>
    ) : !current && !remoteQueue.upcoming.length ? (
      <p className="queue-empty">{remoteQueue.failed ? `Couldn't load the ${providerName} queue.` : 'Nothing playing yet.'}</p>
    ) : (
      <ol className="queue-list" ref={listRef}>
        {current && (
          <li>
            <div className="queue-item current" aria-current="true">
              <RowContent track={current} num="▶" art={art} />
            </div>
          </li>
        )}
        {remoteQueue.upcoming.length > 0 && <li className="queue-heading">Up Next</li>}
        {remoteQueue.upcoming.map((t, i) => (
          <li key={`${t.key}-${i}`}>
            {canSkip ? (
              <button type="button" className="queue-item" onClick={() => skipTo(i + 1)} disabled={skipping} title={`Play ${t.title}`}>
                <RowContent track={t} num={i + 1} art={art} />
              </button>
            ) : (
              <div className="queue-item"><RowContent track={t} num={i + 1} art={art} /></div>
            )}
          </li>
        ))}
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
    current = upcoming[queueCursor] || track;
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
              <RowContent track={t} num={i === queueCursor ? '▶' : i + 1} art={art} />
            </button>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <aside className={`wmp-now-playing-pane queue-pane ${art ? 'with-art' : ''}`} aria-label="Playlist">
      <div className="wmp-now-playing-pane-header">
        <span>Playlist</span>
        <span className="pane-tools">
          <span className="pane-view-switch" role="group" aria-label="Playlist view">
            <button type="button" className="pane-view" aria-pressed={!art} onClick={() => chooseView('list')} title="List only" aria-label="List only">
              <span aria-hidden="true">☰</span>
            </button>
            <button type="button" className="pane-view" aria-pressed={art} onClick={() => chooseView('art')} title="Art and list" aria-label="Art and list">
              <span aria-hidden="true">▦</span>
            </button>
          </span>
          <button type="button" className="pane-close" onClick={onClose} aria-label="Hide Playlist pane">×</button>
        </span>
      </div>
      {art && <NowCover track={current} />}
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
