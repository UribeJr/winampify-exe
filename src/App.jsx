import React, { useState, useEffect } from 'react';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'YOUR_CLIENT_ID';
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';

function App() {
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [player, setPlayer] = useState(null);
  const [isPaused, setPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isActive, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState('playlists');
  const [viewMode, setViewMode] = useState('mediaLibrary'); // 'nowPlaying' | 'mediaLibrary' | 'playlist'
  const [playlistPaneVisible, setPlaylistPaneVisible] = useState(false);
  const [equalizerVisible, setEqualizerVisible] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [libraryAlbums, setLibraryAlbums] = useState([]);
  const [savedShows, setSavedShows] = useState([]);
  const [isLoadingLibraryTracks, setIsLoadingLibraryTracks] = useState(false);
  const [isLoadingLibraryAlbums, setIsLoadingLibraryAlbums] = useState(false);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [likedTracks, setLikedTracks] = useState([]);
  const [isLoadingLiked, setIsLoadingLiked] = useState(false);


  // Live progress updates for real Spotify player
  useEffect(() => {
    if (isActive && !isPaused && player && deviceId) {
      const interval = setInterval(async () => {
        try {
          const state = await player.getCurrentState();
          if (state) {
            setPosition(state.position || 0);
            setDuration(state.duration || 0);
            setPaused(state.paused);
          }
        } catch (err) {
          console.error('Error getting player state:', err);
        }
      }, 100); // Update every 100ms for smooth progress
      
      return () => clearInterval(interval);
    }
  }, [isActive, isPaused, player, deviceId]);

  useEffect(() => {
    // Handle unhandled promise rejections (like EMEError)
    const handleUnhandledRejection = (event) => {
      // Suppress EMEError/DRM-related errors as they're often non-critical
      const reason = event.reason;
      const errorMessage = reason?.message || reason?.toString() || '';
      const errorName = reason?.name || '';
      
      if (
        errorName === 'EMEError' ||
        errorMessage.includes('EME') ||
        errorMessage.includes('keysystem') ||
        errorMessage.includes('No supported keysystem')
      ) {
        // Suppress the error - it's a DRM warning that doesn't prevent playback
        event.preventDefault();
        event.stopPropagation();
        console.info('DRM note: Some browsers may show DRM warnings, but playback should still work.');
        return true;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Get token from URL hash
    const hash = window.location.hash
      .substring(1)
      .split('&')
      .reduce((initial, item) => {
        if (item) {
          const parts = item.split('=');
          initial[parts[0]] = decodeURIComponent(parts[1]);
        }
        return initial;
      }, {});

    window.location.hash = '';
    const _token = hash.access_token;
    const _refreshToken = hash.refresh_token;

    if (_token) {
      setToken(_token);
      // Store refresh token in localStorage for token refresh
      if (_refreshToken) {
        setRefreshToken(_refreshToken);
        localStorage.setItem('spotify_refresh_token', _refreshToken);
      }
    } else {
      // Check if we have a stored refresh token
      const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
      if (storedRefreshToken) {
        setRefreshToken(storedRefreshToken);
      }
    }

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Close View menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (viewMenuOpen && !event.target.closest('.menu-bar-dropdown')) {
        setViewMenuOpen(false);
      }
    };

    if (viewMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [viewMenuOpen]);

  // Close File menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileMenuOpen && !event.target.closest('.menu-bar-dropdown')) {
        setFileMenuOpen(false);
      }
    };

    if (fileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [fileMenuOpen]);

  useEffect(() => {
    if (!token) return;

    // Check if script is already loaded
    if (window.Spotify) {
      initializePlayer();
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      // Wait for it to load
      const checkSpotify = setInterval(() => {
        if (window.Spotify) {
          clearInterval(checkSpotify);
          initializePlayer();
        }
      }, 100);
      return () => clearInterval(checkSpotify);
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    script.onerror = () => {
      console.error('Failed to load Spotify Web Playback SDK');
    };

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer();
    };

    function initializePlayer() {
      if (!window.Spotify) {
        console.error('Spotify SDK not available');
        return;
      }

      const player = new window.Spotify.Player({
        name: 'Web Playback SDK',
        getOAuthToken: cb => { 
          cb(token); 
        },
        volume
      });

      setPlayer(player);

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setError(null); // Clear any previous errors when device connects
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device has gone offline', device_id);
        setActive(false);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) {
          return;
        }

        setCurrentTrack(state.track_window.current_track);
        setPaused(state.paused);
        setActive(true);
        setPosition(state.position || 0);
        setDuration(state.duration || 0);

        player.getCurrentState().then(state => {
          (!state) ? setActive(false) : setActive(true);
        });
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message);
        setError('Authentication failed. Please log in again with updated permissions.');
        // Clear token and reset after a moment
        setTimeout(() => {
          setToken('');
          setError(null);
          window.location.hash = '';
        }, 2000);
      });

      player.addListener('account_error', ({ message }) => {
        console.error('Account error:', message);
      });

      player.addListener('playback_error', async ({ message }) => {
        console.error('Playback error:', message);
        
        // Check if it's a DRM/license error (403 on Widevine license) - often due to expired token
        if (message.includes('license') || message.includes('403') || message.includes('Widevine')) {
          // Try to refresh the token if we have a refresh token
          const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
          if (storedRefreshToken) {
            try {
              const response = await fetch(`${API_BASE_URL}/refresh_token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: storedRefreshToken })
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.access_token) {
                  console.log('Token refreshed successfully');
                  setToken(data.access_token);
                  setError(null);
                  // The player will automatically use the new token via getOAuthToken callback
                  return;
                }
              }
            } catch (err) {
              console.error('Failed to refresh token:', err);
            }
          }
          
          setError('DRM license error: Token may have expired. Please log out and log back in to refresh your token.');
        } else {
          setError(`Playback error: ${message}. Try pausing and resuming playback.`);
        }
      });

      player.addListener('initialization_error', ({ message }) => {
        // According to Spotify SDK docs, initialization_error is emitted when:
        // "the Spotify.Player fails to instantiate a player capable of playing content 
        // in the current environment. Most likely due to the browser not supporting EME protection."
        
        if (message.includes('scope') || message.includes('token') || message.includes('authentication')) {
          console.error('Authentication error:', message);
          setError('Token missing required permissions. Please log out and log in again.');
        } else {
          // EME/DRM initialization error - check browser compatibility
          const userAgent = navigator.userAgent.toLowerCase();
          const isChrome = userAgent.includes('chrome') && !userAgent.includes('edge');
          const isFirefox = userAgent.includes('firefox');
          const isEdge = userAgent.includes('edge');
          const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
          const isOpera = userAgent.includes('opera');
          
          const supportedBrowser = isChrome || isFirefox || isEdge || isSafari || isOpera;
          
          console.warn('Initialization error (EME/DRM related):', message);
          
          if (!supportedBrowser) {
            setError('Your browser may not fully support the Web Playback SDK. Try Chrome, Firefox, Edge, Opera, or Safari.');
          } else {
            // Check if device connects after a delay - if it does, the error is non-critical
            setTimeout(() => {
              player.getCurrentState().then(state => {
                if (state || deviceId) {
                  console.log('✓ Player connected successfully despite initialization warning');
                  setError(null);
                } else {
                  // Device didn't connect - show helpful message
                  setError('Player initialization failed. This may be due to browser DRM support. Try a different browser or check browser extensions that might block encrypted media.');
                }
              }).catch(() => {
                // Check deviceId as fallback
                if (!deviceId) {
                  setError('Unable to connect. Please try: 1) Using Chrome/Firefox/Edge, 2) Disabling privacy extensions, 3) Checking browser permissions for encrypted media.');
                }
              });
            }, 3000);
          }
        }
      });

      player.connect().catch(err => {
        // EMEError is often non-critical - check if it's a DRM-related error
        if (err && err.message && (err.message.includes('EME') || err.message.includes('keysystem'))) {
          console.warn('DRM warning (may be ignored):', err.message);
          // Continue anyway - player may still work
        } else {
          console.error('Failed to connect player:', err);
          setError('Failed to connect to Spotify. Please try logging out and logging in again.');
        }
      });
    }

    return () => {
      // Cleanup will be handled by the player state
    };
  }, [token]);

  // Cleanup player on unmount
  useEffect(() => {
    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [player]);

  const handleVolumeChange = (event) => {
    const value = parseFloat(event.target.value);
    setVolume(value);
    if (player) {
      player.setVolume(value).catch(() => {});
    }
  };

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/login`;
  };

  const fetchWithToken = async (url, options = {}) => {
    if (!token) throw new Error('No token');
    const headers = options.headers ? { ...options.headers } : {};
    headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data?.error || response.statusText);
      error.status = response.status; // Preserve status code for error handling
      error.details = data;
      throw error;
    }
    return response.json();
  };

  // Load playlists on login or when view mode is mediaLibrary
  useEffect(() => {
    if (!token || (viewMode !== 'mediaLibrary' && activeTab !== 'playlists')) return;
    const loadPlaylists = async () => {
      setIsLoadingPlaylists(true);
      try {
          const data = await fetchWithToken(`${API_BASE_URL}/api/playlists`);
        setPlaylists(data.items || []);
      } catch (err) {
        console.error('Failed to load playlists', err);
      } finally {
        setIsLoadingPlaylists(false);
      }
    };
    loadPlaylists();
  }, [token, viewMode, activeTab]);

  // Load dashboard data when in mediaLibrary view
  useEffect(() => {
    if (!token || viewMode !== 'mediaLibrary') return;
    
    const loadDashboardData = async () => {
      // Load liked tracks if not loaded
      if (likedTracks.length === 0 && !isLoadingLiked) {
        setIsLoadingLiked(true);
        try {
          const data = await fetchWithToken(`${API_BASE_URL}/api/library/tracks?limit=100`);
          setLikedTracks(data.items || []);
        } catch (err) {
          console.error('Failed to load liked tracks', err);
        } finally {
          setIsLoadingLiked(false);
        }
      }
      
      // Load library albums if not loaded
      if (libraryAlbums.length === 0 && !isLoadingLibraryAlbums) {
        setIsLoadingLibraryAlbums(true);
        try {
          const data = await fetchWithToken(`${API_BASE_URL}/api/library/albums?limit=20`);
          setLibraryAlbums(data.items || []);
        } catch (err) {
          console.error('Failed to load saved albums', err);
        } finally {
          setIsLoadingLibraryAlbums(false);
        }
      }
      
    };
    
    loadDashboardData();
  }, [token, viewMode]);

  // Load saved library items
  useEffect(() => {
    if (!token || activeTab !== 'library') return;
    const loadLibraryTracks = async () => {
      setIsLoadingLibraryTracks(true);
      try {
        const data = await fetchWithToken(`${API_BASE_URL}/api/library/tracks?limit=50`);
        setLibraryTracks(data.items || []);
      } catch (err) {
        console.error('Failed to load saved tracks', err);
      } finally {
        setIsLoadingLibraryTracks(false);
      }
    };

    const loadLibraryAlbums = async () => {
      setIsLoadingLibraryAlbums(true);
      try {
        const data = await fetchWithToken(`${API_BASE_URL}/api/library/albums?limit=20`);
        setLibraryAlbums(data.items || []);
      } catch (err) {
        console.error('Failed to load saved albums', err);
      } finally {
        setIsLoadingLibraryAlbums(false);
      }
    };

    if (libraryTracks.length === 0) loadLibraryTracks();
    if (libraryAlbums.length === 0) loadLibraryAlbums();
  }, [token, activeTab]);

  // Load saved shows (podcasts)
  useEffect(() => {
    if (!token || activeTab !== 'podcasts') return;
    const loadShows = async () => {
      setIsLoadingShows(true);
      try {
        const data = await fetchWithToken(`${API_BASE_URL}/api/library/shows?limit=20`);
        setSavedShows(data.items || []);
      } catch (err) {
        console.error('Failed to load saved shows', err);
      } finally {
        setIsLoadingShows(false);
      }
    };
    if (savedShows.length === 0) loadShows();
  }, [token, activeTab]);

  // Load liked tracks (Music tab)
  useEffect(() => {
    if (!token || activeTab !== 'music') return;
    const loadLiked = async () => {
      setIsLoadingLiked(true);
      try {
        const data = await fetchWithToken(`${API_BASE_URL}/api/library/tracks?limit=100`);
        setLikedTracks(data.items || []);
      } catch (err) {
        console.error('Failed to load liked tracks', err);
      } finally {
        setIsLoadingLiked(false);
      }
    };
    if (likedTracks.length === 0) loadLiked();
  }, [token, activeTab]);

  const loadPlaylistTracks = async (playlist) => {
    if (!playlist) return;
    setSelectedPlaylist(playlist);
    setIsLoadingTracks(true);
    try {
      const data = await fetchWithToken(`${API_BASE_URL}/api/playlists/${playlist.id}/tracks?limit=100`);
      setTracks(data.items || []);
    } catch (err) {
      console.error('Failed to load tracks', err);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleSelectPlaylist = (playlist) => {
    loadPlaylistTracks(playlist);
  };

  const handleHome = () => {
    setViewMode('mediaLibrary');
    setSelectedPlaylist(null);
    setTracks([]);
  };

  const ensureTransferred = async () => {
    if (!deviceId) throw new Error('Device not ready');
    try {
      await fetchWithToken(`${API_BASE_URL}/api/playback/transfer`, {
        method: 'PUT',
        body: JSON.stringify({ device_id: deviceId, play: true })
      });
    } catch (err) {
      console.error('Transfer failed', err);
      throw err;
    }
  };

  const handlePlayPlaylist = async (playlist) => {
    if (!playlist) return;
    try {
      await ensureTransferred();
      await fetchWithToken(`${API_BASE_URL}/api/playback/play`, {
        method: 'PUT',
        body: JSON.stringify({
          device_id: deviceId,
          context_uri: playlist.uri
        })
      });
    } catch (err) {
      console.error('Failed to play playlist', err);
      setError('Unable to start playlist playback.');
    }
  };

  const handlePlayTrack = async (trackUri, playlistUri) => {
    if (!trackUri) return;
    try {
      await ensureTransferred();
      await fetchWithToken(`${API_BASE_URL}/api/playback/play`, {
        method: 'PUT',
        body: JSON.stringify({
          device_id: deviceId,
          context_uri: playlistUri || undefined,
          uris: playlistUri ? undefined : [trackUri],
          offset: playlistUri ? { uri: trackUri } : undefined
        })
      });
    } catch (err) {
      console.error('Failed to play track', err);
      setError('Unable to start track playback.');
    }
  };

  const handlePlayAlbum = async (albumUri) => {
    if (!albumUri) return;
    try {
      await ensureTransferred();
      await fetchWithToken(`${API_BASE_URL}/api/playback/play`, {
        method: 'PUT',
        body: JSON.stringify({
          device_id: deviceId,
          context_uri: albumUri
        })
      });
    } catch (err) {
      console.error('Failed to play album', err);
      setError('Unable to start album playback.');
    }
  };

  const formatTime = (ms) => {
    if (!ms || Number.isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const handlePlayPause = () => {
    if (player) {
      player.togglePlay();
    }
  };

  const handleNextTrack = () => {
    if (player) {
      player.nextTrack();
    }
  };

  const handlePreviousTrack = () => {
    if (player) {
      player.previousTrack();
    }
  };

  const handleStop = () => {
    if (player) {
      player.pause();
      setPaused(true);
    }
  };

  const handleLogout = () => {
    if (player) {
      player.disconnect();
    }
    setToken('');
    setRefreshToken('');
    setPlayer(null);
    setDeviceId('');
    setActive(false);
    setCurrentTrack(null);
    setError(null);
    localStorage.removeItem('spotify_refresh_token');
    window.location.hash = '';
  };

  if (!token) {
    return (
      <React.Fragment>
        <div className="wmp-shell">
          <div className="window">
            <div className="title-bar">
              <div className="title-bar-text">
                <span className="wmp-icon" aria-hidden="true"></span>
                Windows Media Player
              </div>
              <div className="title-bar-controls">
                <button aria-label="Minimize"></button>
                <button aria-label="Maximize"></button>
                <button aria-label="Close"></button>
              </div>
            </div>
            <div className="menu-bar">
              <button className="menu-bar-item"><u>F</u>ile</button>
              <button className="menu-bar-item"><u>V</u>iew</button>
              <button className="menu-bar-item"><u>P</u>lay</button>
              <button className="menu-bar-item">F<u>a</u>vorites</button>
              <button className="menu-bar-item"><u>G</u>o</button>
              <button className="menu-bar-item"><u>H</u>elp</button>
            </div>
            <div className="window-body">
              <div className="wmp-login">
                <div className="wmp-login-content">
                  <div className="wmp-login-icon">
                    <span className="wmp-icon-large" aria-hidden="true"></span>
                  </div>
                  <div className="wmp-login-text">
                    <h1>Windows Media Player</h1>
                    <p className="wmp-login-subtitle">Connect to Spotify to access your music library</p>
                  </div>
                  <div className="wmp-login-features">
                    <div className="wmp-feature-item">
                      <span className="feature-icon">🎵</span>
                      <span>Access your playlists</span>
                    </div>
                    <div className="wmp-feature-item">
                      <span className="feature-icon">📻</span>
                      <span>Stream music instantly</span>
                    </div>
                    <div className="wmp-feature-item">
                      <span className="feature-icon">🎧</span>
                      <span>Control playback</span>
                    </div>
                  </div>
                  <div className="wmp-login-action">
                    <button className="btn wmp-login-btn" onClick={handleLogin}>
                      Sign In with Spotify
                    </button>
                    <p className="wmp-login-note">You will be redirected to Spotify to authorize this application</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="win98-taskbar">
          <button className="taskbar-start">
            <span className="start-logo" aria-hidden="true"></span>
            <span className="start-text">Start</span>
          </button>
          <div className="taskbar-apps">
            <button className="taskbar-app active">
              <span className="app-icon" aria-hidden="true"></span>
              <span className="app-text">Windows Media Player</span>
            </button>
          </div>
          <div className="taskbar-tray">
            <div className="tray-icon" title="Volume">🔊</div>
            <div className="tray-icon" title="Network">📡</div>
            <div className="tray-time">2:50 PM</div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="wmp-shell">
        <div className={`window ${isMinimized ? 'minimized' : ''}`}>
          <div className="title-bar">
            <div className="title-bar-text">
              <span className="wmp-icon" aria-hidden="true"></span>
              Windows Media Player
            </div>
            <div className="title-bar-controls">
              <button aria-label="Minimize" onClick={() => setIsMinimized(true)}></button>
              <button aria-label="Maximize"></button>
              <button aria-label="Close"></button>
            </div>
          </div>

          <div className="menu-bar">
            <div className="menu-bar-item menu-bar-dropdown">
              <button className="menu-bar-item" onClick={() => setFileMenuOpen(!fileMenuOpen)}><u>F</u>ile</button>
              {fileMenuOpen && (
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={() => { handleLogout(); setFileMenuOpen(false); }}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
            <div className="menu-bar-item menu-bar-dropdown">
              <button className="menu-bar-item" onClick={() => setViewMenuOpen(!viewMenuOpen)}><u>V</u>iew</button>
              {viewMenuOpen && (
                <div className="menu-dropdown">
                  <button className={`menu-dropdown-item ${viewMode === 'nowPlaying' ? 'active' : ''}`} onClick={() => { setViewMode('nowPlaying'); setViewMenuOpen(false); }}>
                    Now Playing
                  </button>
                  <button className={`menu-dropdown-item ${viewMode === 'mediaLibrary' ? 'active' : ''}`} onClick={() => { setViewMode('mediaLibrary'); setViewMenuOpen(false); }}>
                    Media Library
                  </button>
                  <button className={`menu-dropdown-item ${viewMode === 'playlist' ? 'active' : ''}`} onClick={() => { setViewMode('playlist'); setViewMenuOpen(false); }}>
                    Playlist
                  </button>
                  <div className="menu-dropdown-separator"></div>
                  <button className={`menu-dropdown-item ${toolbarVisible ? 'active' : ''}`} onClick={() => { setToolbarVisible(!toolbarVisible); setViewMenuOpen(false); }}>
                    {toolbarVisible ? 'Hide' : 'Show'} Toolbar
                  </button>
                  <button className={`menu-dropdown-item ${playlistPaneVisible ? 'active' : ''}`} onClick={() => { setPlaylistPaneVisible(!playlistPaneVisible); setViewMenuOpen(false); }}>
                    {playlistPaneVisible ? 'Hide' : 'Show'} Playlist Pane
                  </button>
                </div>
              )}
            </div>
            <button className="menu-bar-item"><u>P</u>lay</button>
            <button className="menu-bar-item">F<u>a</u>vorites</button>
            <button className="menu-bar-item"><u>G</u>o</button>
            <button className="menu-bar-item"><u>H</u>elp</button>
          </div>

          {/* Toolbar */}
          {toolbarVisible && (
          <div className="wmp-toolbar">
            <button 
              className="toolbar-nav-btn" 
              onClick={() => {
                if (historyIndex > 0) {
                  setHistoryIndex(historyIndex - 1);
                  // Navigate back logic can be added here
                }
              }}
              disabled={historyIndex <= 0}
              title="Back"
            >
              <span className="toolbar-icon toolbar-icon-back"></span>
            </button>
            <button 
              className="toolbar-nav-btn" 
              onClick={() => {
                if (historyIndex < navigationHistory.length - 1) {
                  setHistoryIndex(historyIndex + 1);
                  // Navigate forward logic can be added here
                }
              }}
              disabled={historyIndex >= navigationHistory.length - 1}
              title="Forward"
            >
              <span className="toolbar-icon toolbar-icon-forward"></span>
            </button>
            <button 
              className="toolbar-nav-btn" 
              onClick={handleHome}
              title="Home"
            >
              <span className="toolbar-icon toolbar-icon-home"></span>
            </button>
            <div className="toolbar-separator"></div>
          </div>
          )}

          <div className="window-body">
            {error && (
              <div className="wmp-error">
                <div className="wmp-error-body">
                  <p>{error}</p>
                  <button className="btn" onClick={handleLogout}>
                    Log Out & Try Again
                  </button>
                </div>
          </div>
        )}

            {/* Main Content Area - View Based */}
            <div className="wmp-content-wrapper">
              <div className="wmp-main-content">
                {viewMode === 'nowPlaying' && (
                  <div className="wmp-now-playing-view">
                    <div className="wmp-visualization-area">
                      {currentTrack?.album?.images?.[0]?.url ? (
                        <img 
                          src={currentTrack.album.images[0].url} 
                          alt={currentTrack.name}
                          className="wmp-album-art-large"
                        />
                      ) : (
                        <div className="wmp-album-art-placeholder">🎵</div>
                      )}
                      <div className="wmp-visualization-bars">
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                        <div className="viz-bar"></div>
                      </div>
                    </div>
                    <div className="wmp-track-info-large">
                      <h2 className="wmp-track-title">{currentTrack?.name || 'No track playing'}</h2>
                      <p className="wmp-track-artist">{currentTrack?.artists?.map(a => a.name).join(', ') || 'Select a track to play'}</p>
                      <p className="wmp-track-album">{currentTrack?.album?.name || ''}</p>
                    </div>
                    <div className="wmp-progress-area">
                      <div className="wmp-progress-track-large">
                        <div 
                          className="wmp-progress-fill-large" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="wmp-progress-times-large">
                        <span>{formatTime(position)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'mediaLibrary' && (
                  <div className="wmp-media-library-view">
                    <div className="wmp-library-sidebar">
                      <div className="tree-view">
                        <details open>
                          <summary>My Playlists</summary>
                          <ul>
                            {playlists.map(pl => (
                              <li 
                                key={pl.id}
                                className={selectedPlaylist?.id === pl.id ? 'selected' : ''}
                                onClick={() => handleSelectPlaylist(pl)}
                              >
                                {pl.name}
                              </li>
                            ))}
                          </ul>
                        </details>
                        <details>
                          <summary>My Music</summary>
                          <ul>
                            <li onClick={() => setActiveTab('music')}>Liked Songs</li>
                          </ul>
                        </details>
                        <details>
                          <summary>My Albums</summary>
                          <ul>
                            {libraryAlbums.slice(0, 10).map(item => (
                              <li key={item.album?.id}>{item.album?.name}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    </div>
                    <div className="wmp-library-content">
                      {selectedPlaylist ? (
                        <div className="wmp-playlist-detail">
                          <h3>{selectedPlaylist.name}</h3>
                          <div className="wmp-track-list">
                            {tracks.map((item) => {
                              const track = item.track;
                              if (!track) return null;
                              return (
                                <div className="wmp-track-row" key={track.id}>
                                  <span className="track-title" onClick={() => handlePlayTrack(track.uri, selectedPlaylist.uri)}>{track.name}</span>
                                  <span className="track-artist">{track.artists?.map(a => a.name).join(', ')}</span>
                                  <span className="track-length">{formatTime(track.duration_ms)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="wmp-dashboard">
                          <div className="dashboard-header">
                            <h2>Media Library</h2>
                            <p className="dashboard-subtitle">Welcome to your music collection</p>
                          </div>
                          
                          <div className="dashboard-sections">
                            <div className="dashboard-section">
                              <div className="section-header">
                                <h3>Recent Playlists</h3>
                              </div>
                              <div className="section-content">
                                {isLoadingPlaylists ? (
                                  <div className="dashboard-placeholder">Loading playlists...</div>
                                ) : playlists.length === 0 ? (
                                  <div className="dashboard-placeholder">No playlists available</div>
                                ) : (
                                  <div className="playlist-list">
                                    {playlists.slice(0, 5).map((pl) => (
                                      <div 
                                        key={pl.id} 
                                        className="playlist-list-item"
                                        onClick={() => handleSelectPlaylist(pl)}
                                      >
                                        <span className="playlist-list-icon">📋</span>
                                        <span className="playlist-list-name">{pl.name}</span>
                                        <span className="playlist-list-count">{pl.tracks?.total ?? 0} songs</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="dashboard-section">
                              <div className="section-header">
                                <h3>Liked Songs</h3>
                              </div>
                              <div className="section-content">
                                {isLoadingLiked ? (
                                  <div className="dashboard-placeholder">Loading liked songs...</div>
                                ) : likedTracks.length === 0 ? (
                                  <div className="dashboard-placeholder">No liked songs</div>
                                ) : (
                                  <div className="playlist-list">
                                    {likedTracks.slice(0, 10).map((item) => {
                                      const track = item.track;
                                      if (!track) return null;
                                      return (
                                        <div 
                                          key={track.id} 
                                          className="playlist-list-item"
                                          onClick={() => handlePlayTrack(track.uri)}
                                        >
                                          {track.album?.images?.[2]?.url ? (
                                            <img 
                                              src={track.album.images[2].url} 
                                              alt={track.name}
                                              style={{ width: '16px', height: '16px', objectFit: 'cover', marginRight: '8px' }}
                                            />
                                          ) : (
                                            <span className="playlist-list-icon">🎵</span>
                                          )}
                                          <span className="playlist-list-name">{track.name}</span>
                                          <span className="playlist-list-count">{track.artists?.map(a => a.name).join(', ')}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'playlist' && (
                  <div className="wmp-playlist-view">
                    <div className="wmp-playlist-header">
                      <h3>Playlist</h3>
                    </div>
                    <div className="wmp-playlist-table">
                      <div className="wmp-playlist-table-header">
                        <span>Title</span>
                        <span>Artist</span>
                        <span>Length</span>
                      </div>
                      <div className="wmp-playlist-table-body">
                        {tracks.length > 0 ? tracks.map((item) => {
                          const track = item.track;
                          if (!track) return null;
                          return (
                            <div 
                              className="wmp-playlist-table-row" 
                              key={track.id}
                              onClick={() => handlePlayTrack(track.uri, selectedPlaylist?.uri)}
                            >
                              <span>{track.name}</span>
                              <span>{track.artists?.map(a => a.name).join(', ')}</span>
                              <span>{formatTime(track.duration_ms)}</span>
                            </div>
                          );
                        }) : (
                          <div className="wmp-playlist-table-row">
                            <span>No tracks in playlist</span>
                            <span></span>
                            <span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Playlist Pane */}
              {playlistPaneVisible && (
                <div className="wmp-playlist-pane">
                  <div className="wmp-playlist-pane-header">
                    <span>Playlist</span>
                    <button className="btn" onClick={() => setPlaylistPaneVisible(false)}>×</button>
                  </div>
                  <div className="wmp-playlist-pane-content">
                    {tracks.map((item, index) => {
                      const track = item.track;
                      if (!track) return null;
                      return (
                        <div key={track.id} className="wmp-playlist-pane-item">
                          <span className="track-num">{index + 1}</span>
                          <span className="track-name">{track.name}</span>
                          <span className="track-time">{formatTime(track.duration_ms)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Playback Control Bar */}
          <div className="wmp-control-bar">
            <div className="control-bar-progress">
              <div className="control-progress-track">
                <div 
                  className="control-progress-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="control-bar-controls">
              <div className="control-buttons-left">
                <button className="control-btn" onClick={handlePlayPause} disabled={!isActive} title="Play/Pause">
                  <span className={`toolbar-icon ${isPaused ? 'toolbar-icon-play' : 'toolbar-icon-pause'}`}></span>
                </button>
                <button className="control-btn" onClick={handleStop} disabled={!isActive} title="Stop">
                  <span className="toolbar-icon toolbar-icon-stop"></span>
                </button>
                <button className="control-btn" onClick={handlePreviousTrack} disabled={!isActive} title="Previous Track">
                  <span className="toolbar-icon toolbar-icon-prev"></span>
                </button>
                <button className="control-btn" onClick={handlePreviousTrack} disabled={!isActive} title="Rewind">
                  <span className="toolbar-icon toolbar-icon-rewind"></span>
                </button>
                <button className="control-btn" onClick={handleNextTrack} disabled={!isActive} title="Fast Forward">
                  <span className="toolbar-icon toolbar-icon-fastforward"></span>
                </button>
                <button className="control-btn" onClick={handleNextTrack} disabled={!isActive} title="Next Track">
                  <span className="toolbar-icon toolbar-icon-next"></span>
                </button>
              </div>
              <div className="control-buttons-right">
                <button className="control-btn" title="Playlist" onClick={() => setPlaylistPaneVisible(!playlistPaneVisible)}>
                  <span className="toolbar-icon toolbar-icon-playlist"></span>
                </button>
                <div className="control-volume">
                  <button className="control-btn" title="Mute" onClick={() => setVolume(volume > 0 ? 0 : 0.5)}>
                    <span className={`toolbar-icon ${volume === 0 ? 'toolbar-icon-mute' : 'toolbar-icon-volume'}`}></span>
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={volume} 
                    onChange={handleVolumeChange}
                    className="control-volume-slider"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="win98-taskbar">
        <button className="taskbar-start">
          <span className="start-logo" aria-hidden="true"></span>
          <span className="start-text">Start</span>
        </button>
        <div className="taskbar-apps">
          <button 
            className={`taskbar-app ${isMinimized ? '' : 'active'}`}
            onClick={() => setIsMinimized(false)}
          >
            <span className="app-icon" aria-hidden="true"></span>
            <span className="app-text">Windows Media Player</span>
          </button>
        </div>
        <div className="taskbar-tray">
          <div className="tray-icon" title="Volume">🔊</div>
          <div className="tray-icon" title="Network">📡</div>
          <div className="tray-time">2:50 PM</div>
        </div>
      </div>
    </React.Fragment>
  );
}

export default App;


