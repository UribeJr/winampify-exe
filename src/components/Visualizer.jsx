import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';

// Manually selected presets that resemble Windows Media Player visuals
// Since we can't easily see them, we'll pick ones with suggestive names or known styles
// and map them to friendly names for the UI.
const WMP_PRESETS = [
  { name: 'Alchemy', key: 'Flexi, martin + geiss - dedicated to the sherwin maxawow' }, // Approximating Alchemy
  { name: 'Battery', key: 'Rovastar + Geiss - Dynamic Swirls 2 (Abstract mix)' },
  { name: 'Particle', key: 'flexi - abstract 03' },
  { name: 'Ambience', key: 'Geiss - Oldskool 02' },
  { name: 'Solid', key: 'Unchained - God of the Game (Remix)' },
];

const Visualizer = forwardRef(({ currentTrack, token, player, isActive }, ref) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const analysisDataRef = useRef(null);
  
  const [allPresets, setAllPresets] = useState({});
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);

  // Expose method to switch presets from parent
  useImperativeHandle(ref, () => ({
    loadPreset: (index) => {
      if (visualizerRef.current && allPresets) {
        const presetKey = WMP_PRESETS[index].key;
        // Fallback to random if key doesn't exist (names in library might differ slightly)
        // butterchurn-presets usually exports a giant object.
        // We'll try to find an exact match or a fuzzy match.
        let preset = allPresets[presetKey];
        
        if (!preset) {
           // Fuzzy search
           const fuzzyKey = Object.keys(allPresets).find(k => k.includes(WMP_PRESETS[index].name) || k.includes(presetKey.split(' - ')[0]));
           preset = allPresets[fuzzyKey];
        }

        // If still not found, just pick one
        if (!preset) {
           const keys = Object.keys(allPresets);
           preset = allPresets[keys[index % keys.length]];
        }

        visualizerRef.current.loadPreset(preset, 1.0);
        setCurrentPresetIndex(index);
      }
    }
  }));

  // Initialize Audio Context and Visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Setup Audio Context (Silent Engine)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 60; 
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.5;

    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;

    oscillator.connect(gainNode);
    gainNode.connect(analyserNode);
    oscillator.start();

    sourceNodeRef.current = oscillator;
    gainNodeRef.current = gainNode;
    analyserNodeRef.current = analyserNode;

    // 2. Setup Butterchurn
    const presets = butterchurnPresets.getPresets();
    setAllPresets(presets);

    const visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, {
      width: 800,
      height: 600,
      pixelRatio: window.devicePixelRatio || 1,
      textureRatio: 1,
    });
    
    // Load initial default preset (0)
    // We do a "safe load" helper
    const loadSafe = (idx) => {
        const key = WMP_PRESETS[idx].key;
        let p = presets[key];
        if (!p) {
             const keys = Object.keys(presets);
             p = presets[keys[Math.floor(Math.random() * keys.length)]];
        }
        visualizer.loadPreset(p, 0); 
    };
    
    loadSafe(0);

    visualizerRef.current = visualizer;

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      oscillator.stop();
      audioContext.close();
    };
  }, []);

  // Fetch Audio Analysis
  useEffect(() => {
    if (!currentTrack || !token) return;

    const fetchAnalysis = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/audio-analysis/${currentTrack.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          analysisDataRef.current = data;
        }
      } catch (error) {
        console.error('Failed to fetch audio analysis', error);
      }
    };

    fetchAnalysis();
  }, [currentTrack, token]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (visualizerRef.current && canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
          visualizerRef.current.setRendererSize(parent.clientWidth, parent.clientHeight);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // Delay slightly to allow layout to settle
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, [visualizerFullscreen]); // Re-run when fullscreen changes

  // Animation Loop
  useEffect(() => {
    const renderLoop = async () => {
      if (!visualizerRef.current || !isActive) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (player && analysisDataRef.current && sourceNodeRef.current && gainNodeRef.current) {
        const state = await player.getCurrentState();
        if (state && !state.paused) {
          const position = state.position / 1000; 
          const analysis = analysisDataRef.current;

          const currentSegment = analysis.segments.find(
            s => position >= s.start && position < s.start + s.duration
          );

          const currentBeat = analysis.beats.find(
            b => position >= b.start && position < b.start + b.duration
          );

          if (currentSegment) {
            const loudness = Math.max(-60, currentSegment.loudness_max);
            const normalizedLoudness = (loudness + 60) / 60;
            const beatBoost = currentBeat ? 1.5 : 1.0;
            
            gainNodeRef.current.gain.setTargetAtTime(
              normalizedLoudness * beatBoost, 
              audioContextRef.current.currentTime, 
              0.05 
            );

            const dominantPitchIndex = currentSegment.pitches.indexOf(Math.max(...currentSegment.pitches));
            const baseFreq = 60 + (dominantPitchIndex * 20); 
            
            sourceNodeRef.current.frequency.setTargetAtTime(
              baseFreq,
              audioContextRef.current.currentTime,
              0.1
            );
          }
        }
      }

      visualizerRef.current.render();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive, player]);

  // We remove the internal click handler for cycling since we now have external buttons
  // But we can keep it as an easter egg or remove it. Let's remove it to strictly follow "5 presets".

  return (
    <div className="wmp-visualizer-container" style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
});

export { WMP_PRESETS };
export default Visualizer;
