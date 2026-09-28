import MediaPlayer from '../player/MediaPlayer';

// Apps that can open as desktop windows. Winampify ships just the media player;
// add entries here (not in App.jsx) to register more.
export const APP_REGISTRY = {
  'media-player': {
    title: 'Windows Media Player',
    icon: 'media',
    component: MediaPlayer,
    singleton: true,
    defaultSize: { width: 1100, height: 720 }
  }
};

// Run dialog commands → app ids
export const RUN_COMMANDS = {
  'wmp.exe': 'media-player',
  wmp: 'media-player',
  mplayer: 'media-player',
  mediaplayer: 'media-player',
  'winampify.exe': 'media-player',
  winampify: 'media-player'
};
