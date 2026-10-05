import React from 'react';
import { MusicContext } from './MusicContext';

const noop = () => {};

const IDLE_PLAYBACK = {
  ready: false,
  isActive: false,
  isPaused: true,
  buffering: false,
  track: null,
  position: 0,
  updatedAt: 0,
  duration: 0,
  volume: 0.8,
  canSetVolume: false,
  shuffle: false,
  repeat: 'off',
  deviceId: '',
  deviceName: ''
};

const IDLE_CONTROLS = {
  playQueue: noop, play: noop, togglePlay: noop, stop: noop, next: noop, previous: noop, seek: noop,
  setVolume: noop, toggleMute: noop, toggleShuffle: noop, cycleRepeat: noop, pauseIfPlaying: noop, clear: noop
};

const EMPTY_LIBRARY = {
  id: null,
  name: '',
  capabilities: { search: false, artists: false, star: false, scrobble: false, recentAlbums: false, devices: false },
  getAudioAnalysis: null
};

const VALUE = {
  provider: null,
  providerName: 'a music service',
  serverLabel: '',
  library: EMPTY_LIBRARY,
  capabilities: EMPTY_LIBRARY.capabilities,
  status: 'anonymous',
  statusMessage: '',
  isAuthenticated: false,
  authError: null,
  clearAuthError: noop,
  login: noop,
  logout: noop,
  user: null,
  playlists: [],
  playlistsLoading: false,
  mode: 'local',
  playback: IDLE_PLAYBACK,
  controls: IDLE_CONTROLS,
  audioGraph: null,
  equalizer: null,
  playerError: null,
  clearPlayerError: noop,
  devices: [],
  selectedDeviceId: '',
  isStarred: () => false,
  toggleStar: noop,
  libraryVersion: 0,
  resetStarred: noop
};

// Idle music context used before the user has picked a service on the sign-in screen.
export default function NoServiceBackend({ children }) {
  return <MusicContext.Provider value={VALUE}>{children}</MusicContext.Provider>;
}
