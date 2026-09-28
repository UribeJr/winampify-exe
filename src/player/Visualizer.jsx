import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';
import { WMP_PRESETS } from './presets';

const findPreset = (presets, index) => {
  const { key, name } = WMP_PRESETS[index];
  if (presets[key]) return presets[key];
  const fuzzy = Object.keys(presets).find((k) => k.includes(name) || k.includes(key.split(' - ')[0]));
  if (fuzzy) return presets[fuzzy];
  const keys = Object.keys(presets);
  return presets[keys[index % keys.length]];
};

/**
 * MilkDrop-style visualizer. Spotify audio is DRM-protected and can't be analysed directly, so a
 * silent oscillator drives butterchurn: shaped by Spotify's audio-analysis (loudness, beats, pitch)
 * when available, and by a gentle sine wave otherwise.
 */
const Visualizer = forwardRef(({ isActive, trackId, getPosition, api, initialPreset = 0 }, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const audioRef = useRef(null);
  const presetsRef = useRef({});
  const analysisRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(isActive);
  const getPositionRef = useRef(getPosition);
  activeRef.current = isActive;
  getPositionRef.current = getPosition;

  useImperativeHandle(ref, () => ({
    loadPreset: (index) => {
      if (visualizerRef.current) visualizerRef.current.loadPreset(findPreset(presetsRef.current, index), 1.0);
    }
  }));

  // Audio graph + butterchurn setup
  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 60;
    const gain = audioContext.createGain();
    gain.gain.value = 0.5;
    oscillator.connect(gain);
    oscillator.start();
    // Opened from a click, so resuming is allowed; the graph never reaches the speakers
    audioContext.resume().catch(() => {});
    audioRef.current = { audioContext, oscillator, gain };

    presetsRef.current = butterchurnPresets.getPresets();
    const { clientWidth, clientHeight } = containerRef.current;
    const visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, {
      width: clientWidth || 800,
      height: clientHeight || 600,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      textureRatio: 1
    });
    visualizer.connectAudio(gain);
    visualizer.loadPreset(findPreset(presetsRef.current, initialPreset), 0);
    visualizerRef.current = visualizer;

    return () => {
      cancelAnimationFrame(frameRef.current);
      oscillator.stop();
      audioContext.close();
      visualizerRef.current = null;
    };
    // initialPreset only matters on mount; later changes go through loadPreset()
  }, []);

  // Follow the container size (window resize, maximize, phone rotation)
  useEffect(() => {
    const el = containerRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!visualizerRef.current || !width || !height) return;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      visualizerRef.current.setRendererSize(width, height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Audio analysis for the current track (may be unavailable for newer Spotify apps)
  useEffect(() => {
    analysisRef.current = null;
    if (!trackId || !api) return undefined;
    let cancelled = false;
    api.getAudioAnalysis(trackId)
      .then((data) => { if (!cancelled && data?.segments) analysisRef.current = data; })
      .catch(() => { /* fall back to the sine driver */ });
    return () => { cancelled = true; };
  }, [trackId, api]);

  // Render loop
  useEffect(() => {
    const render = () => {
      const audio = audioRef.current;
      const visualizer = visualizerRef.current;
      if (visualizer && audio) {
        const now = audio.audioContext.currentTime;
        if (activeRef.current) {
          const analysis = analysisRef.current;
          const seconds = (getPositionRef.current?.() || 0) / 1000;
          const segment = analysis?.segments.find((s) => seconds >= s.start && seconds < s.start + s.duration);
          if (segment) {
            const beat = analysis.beats.find((b) => seconds >= b.start && seconds < b.start + b.duration);
            const loudness = (Math.max(-60, segment.loudness_max) + 60) / 60;
            audio.gain.gain.setTargetAtTime(loudness * (beat ? 1.5 : 1), now, 0.05);
            const pitch = segment.pitches.indexOf(Math.max(...segment.pitches));
            audio.oscillator.frequency.setTargetAtTime(60 + pitch * 20, now, 0.1);
          } else {
            audio.gain.gain.setTargetAtTime(Math.sin(now * 0.5) * 0.2 + 0.5, now, 0.1);
          }
        } else {
          audio.gain.gain.setTargetAtTime(0.05, now, 0.3);
        }
        visualizer.render();
      }
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className="wmp-visualizer-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
});

export default Visualizer;
