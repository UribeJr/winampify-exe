const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise = null;

// Loads the Web Playback SDK once; resolves with window.Spotify.
export function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Failed to load Spotify Web Playback SDK'));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}
