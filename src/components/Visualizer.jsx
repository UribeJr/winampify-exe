import React, { useRef, useEffect, useState } from 'react';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';

const Visualizer = ({ currentTrack, token, player, isActive }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const analysisDataRef = useRef(null);
  const lastPresetSwitchRef = useRef(0);
  
  const [presets, setPresets] = useState({});
  const [presetKeys, setPresetKeys] = useState([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);

  // Initialize Audio Context and Visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Setup Audio Context (Silent Engine)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // Create phantom oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 60; // Base bass frequency
    
    // Create gain node to modulate volume
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.5;

    // Create analyser node for the visualizer
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;

    // Connect: Oscillator -> Gain -> Analyser -> (NOT Destination/Speakers)
    oscillator.connect(gainNode);
    gainNode.connect(analyserNode);
    oscillator.start();

    sourceNodeRef.current = oscillator;
    gainNodeRef.current = gainNode;
    analyserNodeRef.current = analyserNode;

    // 2. Setup Butterchurn
    const allPresets = butterchurnPresets.getPresets();
    setPresets(allPresets);
    const keys = Object.keys(allPresets);
    setPresetKeys(keys);

    const visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, {
      width: 800,
      height: 600,
      pixelRatio: window.devicePixelRatio || 1,
      textureRatio: 1,
    });
    
    // Load initial preset
    if (keys.length > 0) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      setCurrentPresetIndex(randomIndex);
      visualizer.loadPreset(allPresets[keys[randomIndex]], 2.0); // 2.0s transition
    }

    visualizerRef.current = visualizer;

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      oscillator.stop();
      audioContext.close();
    };
  }, []);

  // Fetch Audio Analysis when track changes
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
    handleResize(); // Initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animation Loop
  useEffect(() => {
    const renderLoop = async () => {
      if (!visualizerRef.current || !isActive) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Sync simulated audio with analysis data
      if (player && analysisDataRef.current && sourceNodeRef.current && gainNodeRef.current) {
        const state = await player.getCurrentState();
        if (state && !state.paused) {
          const position = state.position / 1000; // ms to seconds
          const analysis = analysisDataRef.current;

          // Find current segment (for fine-grained detail)
          const currentSegment = analysis.segments.find(
            s => position >= s.start && position < s.start + s.duration
          );

          // Find current beat (for thumping)
          const currentBeat = analysis.beats.find(
            b => position >= b.start && position < b.start + b.duration
          );

          if (currentSegment) {
            // Modulate simulating the "loudness" and "pitch" of the track
            // Map loudness (-60db to 0db) to gain (0 to 1)
            const loudness = Math.max(-60, currentSegment.loudness_max);
            const normalizedLoudness = (loudness + 60) / 60;
            
            // Add a "kick" if we are on a beat
            const beatBoost = currentBeat ? 1.5 : 1.0;
            
            gainNodeRef.current.gain.setTargetAtTime(
              normalizedLoudness * beatBoost, 
              audioContextRef.current.currentTime, 
              0.05 // Quick ramp
            );

            // Modulate frequency based on timbre or pitch (simplified mapping)
            // Use the dominant pitch from the segment
            const dominantPitchIndex = currentSegment.pitches.indexOf(Math.max(...currentSegment.pitches));
            const baseFreq = 60 + (dominantPitchIndex * 20); // Map to bass frequencies
            
            sourceNodeRef.current.frequency.setTargetAtTime(
              baseFreq,
              audioContextRef.current.currentTime,
              0.1
            );
          }
        }
      }

      // Cycle presets
      const now = Date.now();
      if (now - lastPresetSwitchRef.current > 15000) { // Every 15 seconds
        lastPresetSwitchRef.current = now;
        if (presetKeys.length > 0) {
          const nextIndex = Math.floor(Math.random() * presetKeys.length);
          setCurrentPresetIndex(nextIndex);
          visualizerRef.current.loadPreset(presets[presetKeys[nextIndex]], 2.7);
        }
      }

      // Render
      visualizerRef.current.render();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isActive, player, presets, presetKeys]);

  const handleCanvasClick = () => {
    // Manually switch preset on click
    if (presetKeys.length > 0 && visualizerRef.current) {
      const nextIndex = (currentPresetIndex + 1) % presetKeys.length;
      setCurrentPresetIndex(nextIndex);
      visualizerRef.current.loadPreset(presets[presetKeys[nextIndex]], 1.0);
      lastPresetSwitchRef.current = Date.now(); // Reset timer
    }
  };

  return (
    <div className="wmp-visualizer-container" style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
        title="Click to change visualizer preset"
      />
    </div>
  );
};

export default Visualizer;

