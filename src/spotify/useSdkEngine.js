import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { loadSpotifySdk } from './sdkLoader';

const REPEAT_MODES = ['off', 'context', 'track'];
const RESYNC_MS = 1000;

const isDrmNoise = (reason) => {
  const message = reason?.message || String(reason || '');
  return reason?.name === 'EMEError' || /EME|keysystem/i.test(message);
};

export const INITIAL_PLAYBACK = {
  ready: false,
  isActive: false,
  isPaused: true,
  track: null,
  position: 0,
  updatedAt: 0,
  duration: 0,
  volume: 0.5,
  canSetVolume: true,
  shuffle: false,
  repeat: 'off',
  deviceId: '',
  deviceName: ''
};

/**
 * In-browser playback via the Spotify Web Playback SDK (desktop browsers, Premium only).
 * Sets `unsupported` when the browser can't run the SDK, so the caller can fall back to Connect.
 */
export default function useSdkEngine({ enabled, token, api, refresh }) {
  const [playback, setPlayback] = useState(INITIAL_PLAYBACK);
  const [error, setError] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  const playerRef = useRef(null);
  const tokenRef = useRef(token);
  const lastVolumeRef = useRef(0.5);
  const hasToken = Boolean(token);

  tokenRef.current = token;

  // Chrome logs DRM probing failures as unhandled rejections; they don't stop playback.
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (event) => {
      if (isDrmNoise(event.reason)) event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [enabled]);

  // Create one SDK player per session; disconnect on cleanup (also fixes StrictMode duplicates)
  useEffect(() => {
    if (!enabled || !hasToken) return undefined;
    let cancelled = false;
    let player = null;

    loadSpotifySdk()
      .then((Spotify) => {
        if (cancelled) return;
        player = new Spotify.Player({
          name: 'Winampify',
          getOAuthToken: (cb) => cb(tokenRef.current),
          volume: lastVolumeRef.current
        });
        playerRef.current = player;

        player.addListener('ready', ({ device_id }) => {
          setPlayback((p) => ({ ...p, ready: true, deviceId: device_id, deviceName: 'Winampify (this browser)' }));
          setError(null);
        });

        player.addListener('not_ready', () => {
          setPlayback((p) => ({ ...p, ready: false, isActive: false }));
        });

        player.addListener('player_state_changed', (state) => {
          if (!state) {
            // Playback moved to another device
            setPlayback((p) => ({ ...p, isActive: false, isPaused: true }));
            return;
          }
          setPlayback((p) => ({
            ...p,
            isActive: true,
            isPaused: state.paused,
            track: state.track_window?.current_track || null,
            position: state.position || 0,
            updatedAt: Date.now(),
            duration: state.duration || 0,
            shuffle: Boolean(state.shuffle),
            repeat: REPEAT_MODES[state.repeat_mode] || 'off'
          }));
        });

        player.addListener('authentication_error', () => {
          refresh();
        });
        player.addListener('account_error', () => {
          setError('Spotify Premium is required to play music in the browser.');
        });
        player.addListener('playback_error', ({ message }) => {
          setError(`Playback error: ${message}`);
        });
        player.addListener('initialization_error', ({ message }) => {
          console.warn('Web Playback SDK unavailable:', message);
          setUnsupported(true);
        });

        player.connect().then((ok) => {
          if (!ok && !cancelled) setUnsupported(true);
        }).catch((err) => {
          if (!isDrmNoise(err)) console.error('Failed to connect player', err);
        });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setUnsupported(true);
      });

    return () => {
      cancelled = true;
      if (player) player.disconnect();
      playerRef.current = null;
      setPlayback(INITIAL_PLAYBACK);
    };
  }, [enabled, hasToken, refresh]);

  // Periodically resync position with the SDK while playing
  useEffect(() => {
    if (!enabled || !playback.isActive || playback.isPaused) return undefined;
    const id = setInterval(async () => {
      const state = await playerRef.current?.getCurrentState().catch(() => null);
      if (state) {
        setPlayback((p) => ({ ...p, position: state.position, updatedAt: Date.now(), isPaused: state.paused }));
      }
    }, RESYNC_MS);
    return () => clearInterval(id);
  }, [enabled, playback.isActive, playback.isPaused]);

  const deviceId = playback.deviceId;

  const play = useCallback(async ({ contextUri, uris, offsetUri } = {}) => {
    const player = playerRef.current;
    if (!player || !deviceId) {
      setError('The player is still starting up. Try again in a moment.');
      return;
    }
    player.activateElement?.();
    const body = {
      deviceId,
      contextUri,
      uris,
      offset: offsetUri ? { uri: offsetUri } : undefined
    };
    try {
      await api.play(body);
    } catch (err) {
      if (err.status === 404) {
        // Device not registered yet with Spotify Connect: transfer, then retry
        try {
          await api.transfer(deviceId, false);
          await api.play(body);
          return;
        } catch (retryErr) {
          err = retryErr;
        }
      }
      console.error('Failed to start playback', err);
      setError(err.status === 403 ? 'Spotify Premium is required to play music.' : 'Unable to start playback.');
    }
  }, [api, deviceId]);

  const controls = useMemo(() => ({
    play,
    togglePlay: async () => {
      const player = playerRef.current;
      if (!player) return;
      player.activateElement?.();
      if (!playback.isActive && deviceId) {
        // Pull whatever the user was last playing onto this browser
        await api.transfer(deviceId, true).catch(() => setError('Nothing to resume. Pick a song from the library.'));
        return;
      }
      player.togglePlay();
    },
    stop: async () => {
      const player = playerRef.current;
      if (!player) return;
      await player.pause();
      await player.seek(0);
    },
    next: () => playerRef.current?.nextTrack(),
    previous: () => playerRef.current?.previousTrack(),
    seek: (positionMs) => {
      const clamped = Math.max(0, Math.min(positionMs, playback.duration || positionMs));
      setPlayback((p) => ({ ...p, position: clamped, updatedAt: Date.now() }));
      return playerRef.current?.seek(clamped);
    },
    setVolume: (value) => {
      if (value > 0) lastVolumeRef.current = value;
      setPlayback((p) => ({ ...p, volume: value }));
      return playerRef.current?.setVolume(value).catch(() => {});
    },
    toggleMute: () => {
      const next = playback.volume > 0 ? 0 : lastVolumeRef.current || 0.5;
      setPlayback((p) => ({ ...p, volume: next }));
      return playerRef.current?.setVolume(next).catch(() => {});
    },
    toggleShuffle: () => api.setShuffle(!playback.shuffle, deviceId).catch(() => {}),
    cycleRepeat: () => {
      const next = REPEAT_MODES[(REPEAT_MODES.indexOf(playback.repeat) + 1) % REPEAT_MODES.length];
      return api.setRepeat(next, deviceId).catch(() => {});
    },
    pauseIfPlaying: () => {
      if (playback.isActive && !playback.isPaused) playerRef.current?.pause();
    }
  }), [api, deviceId, play, playback.isActive, playback.isPaused, playback.duration, playback.volume, playback.shuffle, playback.repeat]);

  return {
    playback,
    controls,
    error,
    clearError: () => setError(null),
    unsupported
  };
}
