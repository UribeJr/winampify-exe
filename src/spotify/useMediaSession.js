import { useEffect, useRef } from 'react';

const ACTIONS = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'];

/**
 * Lock-screen / hardware media keys for in-browser playback (Navidrome <audio> or the Spotify SDK).
 * Expects the app Track model (src/music/models.js).
 */
export default function useMediaSession({ enabled, playback, controls }) {
  const controlsRef = useRef(controls);
  const playbackRef = useRef(playback);
  controlsRef.current = controls;
  playbackRef.current = playback;

  const track = playback.track;

  useEffect(() => {
    if (!('mediaSession' in navigator) || !enabled || !track) return;
    // Artwork URLs may be relative (Navidrome proxy); the OS needs absolute ones
    const art = track.coverArt ? new URL(track.coverArt, window.location.href) : null;
    if (art && art.pathname.startsWith('/api/nd/cover/')) art.searchParams.set('size', '512');
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title,
      artist: track.artists?.map((a) => a.name).join(', ') || '',
      album: track.album?.name || '',
      artwork: art ? [{ src: art.href, sizes: '512x512' }] : []
    });
  }, [enabled, track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = enabled ? (playback.isPaused ? 'paused' : 'playing') : 'none';
  }, [enabled, playback.isPaused]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !enabled) return undefined;
    const position = () => {
      const p = playbackRef.current;
      return p.isPaused ? p.position : p.position + (Date.now() - p.updatedAt);
    };
    const handlers = {
      play: () => controlsRef.current.togglePlay(),
      pause: () => controlsRef.current.togglePlay(),
      previoustrack: () => controlsRef.current.previous(),
      nexttrack: () => controlsRef.current.next(),
      seekto: (details) => controlsRef.current.seek(details.seekTime * 1000),
      seekbackward: (details) => controlsRef.current.seek(position() - (details.seekOffset || 10) * 1000),
      seekforward: (details) => controlsRef.current.seek(position() + (details.seekOffset || 10) * 1000)
    };
    ACTIONS.forEach((action) => {
      try { navigator.mediaSession.setActionHandler(action, handlers[action]); } catch { /* unsupported action */ }
    });
    return () => {
      ACTIONS.forEach((action) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      });
    };
  }, [enabled]);
}
