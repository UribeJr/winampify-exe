import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isMobileDevice } from '../hooks/useMediaQuery';
import { EQ_BANDS, loadEq, saveEq, withGain, withPreset, preampDb, dbToGain, filterGains } from './equalizer';

const STORAGE_KEY = 'winampify_nd_queue';
const MAX_SAVED_TRACKS = 500;
const POSITION_SAVE_MS = 5000;
const POSITION_SYNC_MS = 2000; // UI interpolates between syncs (see usePlaybackPosition)
const RESTART_THRESHOLD_S = 3;
const SCROBBLE_MIN_TRACK_S = 30;
const SCROBBLE_MAX_LISTEN_S = 240;
const REPEAT_MODES = ['off', 'context', 'track'];

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  },
  save(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
  }
};

// Play order over queue indices. Shuffled orders start with `first` so the chosen track plays now.
const buildOrder = (length, first, shuffled) => {
  const order = Array.from({ length }, (_, i) => i);
  if (!shuffled) return order;
  const rest = order.filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
};

const EMPTY_QUEUE = { tracks: [], order: [], cursor: -1, source: null };

// Real-audio analysis for the visualizer is only safe when the stream is same-origin (otherwise
// Web Audio outputs silence) and not on phones (iOS suspends Web Audio when the screen locks).
const canAnalyse = (streamUrl) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    return Boolean(Ctx) && !isMobileDevice() && new URL(streamUrl, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

// iOS ignores element.volume (hardware buttons only), so hide the slider there instead of faking it
const volumeIsSettable = () => {
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch {
    return false;
  }
};

/**
 * Browser-native playback for Navidrome: one HTMLAudioElement streaming /api/nd/stream/:id,
 * a client-side queue with shuffle/repeat, scrobbling, and queue persistence across refreshes.
 * Exposes the same { playback, controls } contract as the Spotify engines so the Win98 controls are shared.
 */
export default function useAudioEngine({ enabled, library }) {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState(EMPTY_QUEUE);
  const [status, setStatus] = useState({ isPaused: true, position: 0, updatedAt: 0, duration: 0, buffering: false });
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [error, setError] = useState(null);
  const [canSetVolume] = useState(volumeIsSettable);
  const graphRef = useRef(null); // { context, source, preamp, filters, analyser, gain } once built
  const [audioGraph, setAudioGraph] = useState(null);
  const [eq, setEq] = useState(loadEq);
  const eqRef = useRef(eq);
  eqRef.current = eq;

  const lastVolumeRef = useRef(0.8);
  const playRef = useRef({ trackId: null, transcoded: false, restoreAt: null, autoplay: false });
  const scrobbleRef = useRef({ trackId: null, listened: 0, lastTime: 0, submitted: false, announced: false });
  const lastSyncRef = useRef(0);
  const lastSaveRef = useRef(0);

  // Mirror of the latest state for audio event handlers
  const live = useRef({});
  live.current = { queue, shuffle, repeat, volume, library };

  const currentTrack = queue.cursor >= 0 ? queue.tracks[queue.order[queue.cursor]] || null : null;

  const persist = useCallback((overrides = {}) => {
    const { queue: q, shuffle: sh, repeat: rp, volume: vol } = { ...live.current, ...overrides };
    const audio = audioRef.current;
    const position = audio && !Number.isNaN(audio.currentTime) ? audio.currentTime : 0;
    let saved = q;
    if (q.tracks.length > MAX_SAVED_TRACKS) {
      // Too big to persist: keep just the current track
      const current = q.tracks[q.order[q.cursor]];
      saved = current ? { tracks: [current], order: [0], cursor: 0, source: q.source } : EMPTY_QUEUE;
    }
    store.save({ ...saved, shuffle: sh, repeat: rp, volume: vol, position });
    lastSaveRef.current = Date.now();
  }, []);

  const syncPosition = useCallback((force = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current < POSITION_SYNC_MS) return;
    lastSyncRef.current = now;
    setStatus((s) => ({ ...s, position: audio.currentTime * 1000, updatedAt: now }));
  }, []);

  // Loads the track at `cursor` of queue `q` into the audio element
  const load = useCallback((q, cursor, { autoplay = true, startAt = 0, transcode = false } = {}) => {
    const audio = audioRef.current;
    const track = q.tracks[q.order[cursor]];
    if (!audio || !track) return;
    playRef.current = { trackId: track.id, transcoded: transcode, restoreAt: startAt || null, autoplay };
    if (scrobbleRef.current.trackId !== track.id || !transcode) {
      scrobbleRef.current = { trackId: track.id, listened: 0, lastTime: startAt, submitted: false, announced: false };
    }
    setError(null);
    setStatus({ isPaused: !autoplay, position: startAt * 1000, updatedAt: Date.now(), duration: track.durationMs, buffering: autoplay });
    audio.src = live.current.library.getStreamUrl(track.id, { transcode });
    audio.load();
    if (autoplay) {
      audio.play().catch((err) => {
        if (err.name === 'NotAllowedError') setStatus((s) => ({ ...s, isPaused: true, buffering: false }));
      });
    }
  }, []);

  const goTo = useCallback((q, cursor, options) => {
    const next = { ...q, cursor };
    setQueue(next);
    load(next, cursor, options);
    persist({ queue: next });
  }, [load, persist]);

  const advance = useCallback((direction, { fromEnded = false } = {}) => {
    const { queue: q, repeat: rp } = live.current;
    if (!q.tracks.length) return;
    let cursor = q.cursor + direction;
    if (cursor >= q.order.length || cursor < 0) {
      if (rp === 'context') {
        cursor = direction > 0 ? 0 : q.order.length - 1;
      } else if (fromEnded) {
        // End of the queue: stop, like WMP, and rewind to the start of the last track
        const audio = audioRef.current;
        if (audio) audio.currentTime = 0;
        setStatus((s) => ({ ...s, isPaused: true, position: 0, updatedAt: Date.now(), buffering: false }));
        return;
      } else {
        return;
      }
    }
    goTo(q, cursor);
  }, [goTo]);

  // Create the audio element and wire its events once
  useEffect(() => {
    if (!enabled) return undefined;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onPlay = () => setStatus((s) => ({ ...s, isPaused: false, updatedAt: Date.now(), position: audio.currentTime * 1000 }));
    const onPause = () => {
      setStatus((s) => ({ ...s, isPaused: true, buffering: false, position: audio.currentTime * 1000, updatedAt: Date.now() }));
      persist();
    };
    const onPlaying = () => {
      setStatus((s) => ({ ...s, isPaused: false, buffering: false, position: audio.currentTime * 1000, updatedAt: Date.now() }));
      const scrobble = scrobbleRef.current;
      if (!scrobble.announced && scrobble.trackId) {
        scrobble.announced = true;
        live.current.library.scrobble(scrobble.trackId, false).catch(() => {});
      }
    };
    const onWaiting = () => setStatus((s) => ({ ...s, buffering: true }));
    const onSeeked = () => {
      scrobbleRef.current.lastTime = audio.currentTime;
      syncPosition(true);
    };
    const onMetadata = () => {
      const { restoreAt } = playRef.current;
      if (restoreAt) {
        audio.currentTime = restoreAt;
        playRef.current.restoreAt = null;
      }
      if (Number.isFinite(audio.duration)) {
        setStatus((s) => ({ ...s, duration: audio.duration * 1000 }));
      }
    };
    const onTimeUpdate = () => {
      const t = audio.currentTime;
      // Scrobble after real listening time (seeks don't count): half the track or 4 minutes
      const scrobble = scrobbleRef.current;
      const delta = t - scrobble.lastTime;
      if (delta > 0 && delta < 2) scrobble.listened += delta;
      scrobble.lastTime = t;
      const duration = audio.duration || 0;
      if (!scrobble.submitted && scrobble.trackId && duration >= SCROBBLE_MIN_TRACK_S
        && scrobble.listened >= Math.min(duration / 2, SCROBBLE_MAX_LISTEN_S)) {
        scrobble.submitted = true;
        live.current.library.scrobble(scrobble.trackId, true).catch(() => {});
      }
      syncPosition();
      if (Date.now() - lastSaveRef.current > POSITION_SAVE_MS) persist();
    };
    const onEnded = () => {
      if (live.current.repeat === 'track') {
        audio.currentTime = 0;
        scrobbleRef.current = { ...scrobbleRef.current, listened: 0, lastTime: 0, submitted: false, announced: false };
        audio.play().catch(() => {});
        return;
      }
      advance(1, { fromEnded: true });
    };
    const onError = () => {
      const code = audio.error?.code;
      const { queue: q } = live.current;
      const { transcoded, autoplay } = playRef.current;
      // Codec the browser can't decode (e.g. ALAC in Chrome): retry once, transcoded to MP3 by Navidrome
      if (!transcoded && (code === 3 || code === 4) && q.cursor >= 0) {
        load(q, q.cursor, { autoplay, startAt: audio.currentTime || 0, transcode: true });
        return;
      }
      const track = q.tracks[q.order[q.cursor]];
      setStatus((s) => ({ ...s, isPaused: true, buffering: false }));
      setError(`Couldn't play "${track?.title || 'this track'}". Check that your Navidrome server is reachable, then try again.`);
    };

    const events = {
      play: onPlay,
      pause: onPause,
      playing: onPlaying,
      waiting: onWaiting,
      seeked: onSeeked,
      loadedmetadata: onMetadata,
      durationchange: onMetadata,
      timeupdate: onTimeUpdate,
      ended: onEnded,
      error: onError
    };
    Object.entries(events).forEach(([name, handler]) => audio.addEventListener(name, handler));
    const onPageHide = () => persist();
    window.addEventListener('pagehide', onPageHide);

    // Restore the last session, paused (browsers block autoplay on load)
    const saved = store.load();
    if (saved?.tracks?.length && saved.cursor >= 0) {
      const restored = { tracks: saved.tracks, order: saved.order, cursor: saved.cursor, source: saved.source || null };
      setQueue(restored);
      setShuffle(Boolean(saved.shuffle));
      setRepeat(REPEAT_MODES.includes(saved.repeat) ? saved.repeat : 'off');
      if (typeof saved.volume === 'number') {
        audio.volume = saved.volume;
        setVolumeState(saved.volume);
        if (saved.volume > 0) lastVolumeRef.current = saved.volume;
      }
      live.current = { ...live.current, queue: restored };
      load(restored, restored.cursor, { autoplay: false, startAt: saved.position || 0 });
    } else {
      audio.volume = live.current.volume;
    }

    return () => {
      Object.entries(events).forEach(([name, handler]) => audio.removeEventListener(name, handler));
      window.removeEventListener('pagehide', onPageHide);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, [enabled, advance, load, persist, syncPosition]);

  // Persist settings changes
  useEffect(() => {
    if (enabled && queue.tracks.length) persist();
  }, [enabled, shuffle, repeat, volume, persist, queue.tracks.length]);

  // Volume lives on the Web Audio gain once the graph exists (element volume isn't applied
  // consistently to a MediaElementSource), otherwise on the element itself
  const applyVolume = useCallback((value) => {
    const audio = audioRef.current;
    if (graphRef.current) {
      graphRef.current.gain.gain.value = value;
      if (audio) audio.volume = 1;
    } else if (audio) {
      audio.volume = value;
    }
  }, []);

  // Equalizer settings → filters (smoothly, so dragging a slider doesn't click)
  const applyEq = useCallback((settings) => {
    const graph = graphRef.current;
    if (!graph) return;
    const now = graph.context.currentTime;
    filterGains(settings).forEach((db, i) => graph.filters[i].gain.setTargetAtTime(db, now, 0.02));
    graph.preamp.gain.setTargetAtTime(dbToGain(preampDb(settings)), now, 0.02);
  }, []);

  // Route the <audio> element through the equalizer and an analyser (for the visualizer):
  // source → preamp → 10 EQ filters → volume → speakers, with the analyser tapped before volume
  // so visuals keep moving when muted. Built on the first user-initiated play (so the
  // AudioContext may start), at most once.
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (graphRef.current) {
      if (graphRef.current.context.state === 'suspended') graphRef.current.context.resume().catch(() => {});
      return;
    }
    if (!audio || !canAnalyse(live.current.library.getStreamUrl('probe'))) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const context = new Ctx();
      const source = context.createMediaElementSource(audio);
      const preamp = context.createGain();
      const filters = EQ_BANDS.map((frequency, i) => {
        const filter = context.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      const gain = context.createGain();
      [source, preamp, ...filters, gain].reduce((from, to) => { from.connect(to); return to; });
      gain.connect(context.destination);
      filters[filters.length - 1].connect(analyser);
      graphRef.current = { context, source, preamp, filters, analyser, gain };
      applyVolume(live.current.volume);
      applyEq(eqRef.current);
      context.resume().catch(() => {});
      setAudioGraph({ context, analyser });
    } catch (err) {
      console.warn('Web Audio unavailable (no visualizer analysis or equalizer)', err);
    }
  }, [applyVolume, applyEq]);

  useEffect(() => {
    applyEq(eq);
    saveEq(eq);
  }, [eq, applyEq]);

  // Works wherever the graph can be built (Navidrome, same-origin stream, not a phone)
  const eqSupported = useMemo(() => canAnalyse(library.getStreamUrl('probe')), [library]);
  const equalizer = useMemo(() => ({
    supported: eqSupported,
    settings: eq,
    setEnabled: (enabled) => setEq((e) => ({ ...e, enabled })),
    setGain: (index, db) => setEq((e) => withGain(e, index, db)),
    setPreset: (id) => setEq((e) => withPreset(e, id)),
    reset: () => setEq((e) => withPreset(e, 'flat'))
  }), [eq, eqSupported]);

  // Close the audio graph with the engine
  useEffect(() => () => {
    graphRef.current?.context.close().catch(() => {});
    graphRef.current = null;
  }, []);

  const controls = useMemo(() => ({
    playQueue: (tracks, index = 0, source = null) => {
      const playable = tracks.filter((t) => t.playable !== false);
      if (!playable.length) return;
      const start = Math.max(0, playable.indexOf(tracks[index]));
      const next = { tracks: playable, order: buildOrder(playable.length, start, live.current.shuffle), cursor: -1, source };
      const cursor = live.current.shuffle ? 0 : start;
      ensureGraph();
      goTo(next, cursor);
    },
    // Kept for callers written against the Spotify engines
    play: () => {},
    togglePlay: () => {
      const audio = audioRef.current;
      if (!audio || !currentTrack) {
        setError('Pick a song from the Media Library to start playing.');
        return undefined;
      }
      if (audio.paused) {
        ensureGraph();
        return audio.play().catch(() => setStatus((s) => ({ ...s, isPaused: true })));
      }
      audio.pause();
      return undefined;
    },
    stop: () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      setStatus((s) => ({ ...s, isPaused: true, position: 0, updatedAt: Date.now() }));
    },
    next: () => advance(1),
    previous: () => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > RESTART_THRESHOLD_S) {
        audio.currentTime = 0;
        return;
      }
      if (live.current.queue.cursor <= 0 && live.current.repeat !== 'context') {
        if (audio) audio.currentTime = 0;
        return;
      }
      advance(-1);
    },
    seek: (positionMs) => {
      const audio = audioRef.current;
      if (!audio || !currentTrack) return;
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : currentTrack.durationMs;
      const clamped = Math.max(0, Math.min(positionMs, durationMs || positionMs));
      audio.currentTime = clamped / 1000;
      setStatus((s) => ({ ...s, position: clamped, updatedAt: Date.now() }));
    },
    setVolume: (value) => {
      if (value > 0) lastVolumeRef.current = value;
      applyVolume(value);
      setVolumeState(value);
    },
    toggleMute: () => {
      const next = live.current.volume > 0 ? 0 : lastVolumeRef.current || 0.8;
      applyVolume(next);
      setVolumeState(next);
    },
    toggleShuffle: () => {
      const { queue: q, shuffle: on } = live.current;
      const nextShuffle = !on;
      setShuffle(nextShuffle);
      if (q.cursor < 0) return;
      // Re-order around the current track so it keeps playing
      const currentIndex = q.order[q.cursor];
      const order = buildOrder(q.tracks.length, currentIndex, nextShuffle);
      const next = { ...q, order, cursor: nextShuffle ? 0 : currentIndex };
      setQueue(next);
      persist({ queue: next, shuffle: nextShuffle });
    },
    cycleRepeat: () => setRepeat((r) => REPEAT_MODES[(REPEAT_MODES.indexOf(r) + 1) % REPEAT_MODES.length]),
    pauseIfPlaying: () => audioRef.current?.pause(),
    clear: () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      setQueue(EMPTY_QUEUE);
      setStatus({ isPaused: true, position: 0, updatedAt: 0, duration: 0, buffering: false });
      store.clear();
    }
  }), [advance, applyVolume, currentTrack, ensureGraph, goTo, persist]);

  const playback = useMemo(() => ({
    ready: enabled,
    isActive: Boolean(currentTrack),
    isPaused: status.isPaused,
    buffering: status.buffering,
    track: currentTrack,
    position: status.position,
    updatedAt: status.updatedAt,
    duration: status.duration || currentTrack?.durationMs || 0,
    volume,
    canSetVolume,
    shuffle,
    repeat,
    deviceId: 'local',
    deviceName: 'This browser',
    queueSource: queue.source,
    queueLength: queue.tracks.length
  }), [enabled, currentTrack, status, volume, canSetVolume, shuffle, repeat, queue.source, queue.tracks.length]);

  return { playback, controls, audioGraph, equalizer, error, clearError: () => setError(null) };
}
