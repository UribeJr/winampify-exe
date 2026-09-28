import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { INITIAL_PLAYBACK } from './useSdkEngine';

const POLL_MS = 1500;
const COMMAND_SETTLE_MS = 350;
const VOLUME_DEBOUNCE_MS = 250;
const REPEAT_MODES = ['off', 'context', 'track'];

const NO_DEVICE_MESSAGE = 'No Spotify device is active. Open the Spotify app on this phone (or any device), then pick it under Devices.';

const describeError = (err) => {
  if (err?.status === 404) return NO_DEVICE_MESSAGE;
  if (err?.status === 403) return 'Spotify Premium is required to control playback.';
  return 'Spotify didn\'t accept that command. Try again.';
};

/**
 * Remote-control playback via Spotify Connect (Web API). Used on mobile browsers, where the
 * Web Playback SDK can't output audio, and as a fallback when the SDK is unsupported.
 */
export default function useConnectEngine({ enabled, api }) {
  const [playback, setPlayback] = useState({ ...INITIAL_PLAYBACK, ready: true });
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const lastVolumeRef = useRef(0.5);

  const applyState = useCallback((data) => {
    if (!data || !data.device) {
      setPlayback((p) => ({ ...p, isActive: false, isPaused: true }));
      return;
    }
    const volume = typeof data.device.volume_percent === 'number' ? data.device.volume_percent / 100 : null;
    setPlayback((p) => ({
      ...p,
      ready: true,
      isActive: Boolean(data.item),
      isPaused: !data.is_playing,
      track: data.item || null,
      position: data.progress_ms || 0,
      updatedAt: Date.now(),
      duration: data.item?.duration_ms || 0,
      volume: volume ?? p.volume,
      canSetVolume: data.device.supports_volume !== false,
      shuffle: Boolean(data.shuffle_state),
      repeat: data.repeat_state || 'off',
      deviceId: data.device.id || '',
      deviceName: data.device.name || ''
    }));
    if (data.device.id) setSelectedDeviceId((current) => current || data.device.id);
  }, []);

  const poll = useCallback(async () => {
    try {
      applyState(await api.getPlaybackState());
    } catch (err) {
      if (err.status !== 401) console.warn('Playback state poll failed', err);
    }
  }, [api, applyState]);

  const refreshDevices = useCallback(async () => {
    try {
      const data = await api.getDevices();
      setDevices(data.devices || []);
      return data.devices || [];
    } catch (err) {
      console.warn('Device list failed', err);
      return [];
    }
  }, [api]);

  // Poll while the tab is visible
  useEffect(() => {
    if (!enabled) return undefined;
    poll();
    refreshDevices();
    const tick = () => {
      if (document.visibilityState === 'visible') poll();
    };
    pollTimerRef.current = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, poll, refreshDevices]);

  const pollSoon = useCallback(() => {
    setTimeout(poll, COMMAND_SETTLE_MS);
  }, [poll]);

  // Runs a Web API command, then re-polls so the UI reflects the real state
  const run = useCallback(async (command) => {
    try {
      await command();
      setError(null);
    } catch (err) {
      console.error('Connect command failed', err);
      setError(describeError(err));
    } finally {
      pollSoon();
    }
  }, [pollSoon]);

  const targetDeviceId = playback.deviceId || selectedDeviceId;

  const transferTo = useCallback((deviceId) => {
    setSelectedDeviceId(deviceId);
    return run(() => api.transfer(deviceId, !playback.isPaused));
  }, [api, run, playback.isPaused]);

  const play = useCallback(async ({ contextUri, uris, offsetUri } = {}) => {
    let deviceId = targetDeviceId;
    if (!deviceId) {
      const list = await refreshDevices();
      deviceId = list.find((d) => d.is_active)?.id || list[0]?.id || '';
      if (!deviceId) {
        setError(NO_DEVICE_MESSAGE);
        return;
      }
      setSelectedDeviceId(deviceId);
    }
    await run(() => api.play({
      deviceId,
      contextUri,
      uris,
      offset: offsetUri ? { uri: offsetUri } : undefined
    }));
  }, [api, refreshDevices, run, targetDeviceId]);

  const controls = useMemo(() => ({
    play,
    togglePlay: () => {
      if (!playback.isActive) {
        if (!selectedDeviceId) {
          setError(NO_DEVICE_MESSAGE);
          return undefined;
        }
        return run(() => api.transfer(selectedDeviceId, true));
      }
      setPlayback((p) => ({ ...p, isPaused: !p.isPaused, position: p.isPaused ? p.position : p.position + (Date.now() - p.updatedAt), updatedAt: Date.now() }));
      return run(() => (playback.isPaused ? api.play({ deviceId: targetDeviceId }) : api.pause(targetDeviceId)));
    },
    stop: () => run(async () => {
      await api.pause(targetDeviceId);
      await api.seek(0, targetDeviceId);
    }),
    next: () => run(() => api.next(targetDeviceId)),
    previous: () => run(() => api.previous(targetDeviceId)),
    seek: (positionMs) => {
      const clamped = Math.max(0, Math.min(positionMs, playback.duration || positionMs));
      setPlayback((p) => ({ ...p, position: clamped, updatedAt: Date.now() }));
      return run(() => api.seek(clamped, targetDeviceId));
    },
    setVolume: (value) => {
      if (value > 0) lastVolumeRef.current = value;
      setPlayback((p) => ({ ...p, volume: value }));
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = setTimeout(() => {
        run(() => api.setVolume(Math.round(value * 100), targetDeviceId));
      }, VOLUME_DEBOUNCE_MS);
    },
    toggleMute: () => {
      const next = playback.volume > 0 ? 0 : lastVolumeRef.current || 0.5;
      setPlayback((p) => ({ ...p, volume: next }));
      return run(() => api.setVolume(Math.round(next * 100), targetDeviceId));
    },
    toggleShuffle: () => run(() => api.setShuffle(!playback.shuffle, targetDeviceId)),
    cycleRepeat: () => {
      const next = REPEAT_MODES[(REPEAT_MODES.indexOf(playback.repeat) + 1) % REPEAT_MODES.length];
      return run(() => api.setRepeat(next, targetDeviceId));
    },
    // The remote doesn't own the audio, so closing the window leaves playback alone
    pauseIfPlaying: () => {},
    transferTo,
    refreshDevices
  }), [api, play, run, playback.isActive, playback.isPaused, playback.duration, playback.volume, playback.shuffle, playback.repeat, selectedDeviceId, targetDeviceId, transferTo, refreshDevices]);

  return {
    playback,
    controls,
    devices,
    selectedDeviceId,
    error,
    clearError: () => setError(null)
  };
}
