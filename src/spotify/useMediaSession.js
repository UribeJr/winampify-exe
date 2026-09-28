import { useEffect, useRef } from 'react';

const ACTIONS = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'];

/**
 * Lock-screen / hardware media keys for in-browser (SDK) playback.
 */
export default function useMediaSession({ enabled, playback, controls }) {
  const controlsRef = useRef(controls);
  const playbackRef = useRef(playback);
  controlsRef.current = controls;
  playbackRef.current = playback;

  const track = playback.track;

  useEffect(() => {
    if (!('mediaSession' in navigator) || !enabled || !track) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(', ') || '',
      album: track.album?.name || '',
      artwork: (track.album?.images || []).map((img) => ({
        src: img.url,
        sizes: img.width ? `${img.width}x${img.height}` : undefined
      }))
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
