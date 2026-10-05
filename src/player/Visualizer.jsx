import React, { useRef, useEffect } from 'react';
import butterchurn from 'butterchurn';

const BLEND_SECONDS = 1.5;

/**
 * MilkDrop visualizer (butterchurn).
 * - With `audioGraph` (Navidrome on desktop) it listens to the real music via the engine's analyser
 *   and shares the engine's AudioContext (never closes it).
 * - Without it (Spotify, phones) a silent oscillator drives it: shaped by Spotify's audio-analysis
 *   when `getAudioAnalysis` works, otherwise by a gentle sine wave.
 * `presets` is butterchurn-presets' map; `presetKey` picks one (blended when it changes).
 */
const Visualizer = ({ presets, presetKey, audioGraph, active, playing, trackId, getPosition, getAudioAnalysis, lowPower }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const simRef = useRef(null); // { audioContext, oscillator, gain } for the simulated signal
  const analysisRef = useRef(null);
  const frameRef = useRef(null);
  const loadedKeyRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = { playing, getPosition };

  // Create the visualizer on the real audio graph, or on a silent simulated one
  useEffect(() => {
    const { clientWidth, clientHeight } = containerRef.current;
    const size = { width: clientWidth || 800, height: clientHeight || 600 };
    const pixelRatio = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    let visualizer;

    if (audioGraph) {
      visualizer = butterchurn.createVisualizer(audioGraph.context, canvasRef.current, { ...size, pixelRatio, textureRatio: 1 });
      visualizer.connectAudio(audioGraph.analyser);
    } else {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new Ctx();
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 60;
      const gain = audioContext.createGain();
      gain.gain.value = 0.5;
      oscillator.connect(gain);
      oscillator.start();
      // Opened from a click, so resuming is allowed; this graph never reaches the speakers
      audioContext.resume().catch(() => {});
      simRef.current = { audioContext, oscillator, gain };
      visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, { ...size, pixelRatio, textureRatio: 1 });
      visualizer.connectAudio(gain);
    }
    visualizerRef.current = visualizer;
    loadedKeyRef.current = null;

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (audioGraph) {
        try { visualizer.disconnectAudio(audioGraph.analyser); } catch { /* already disconnected */ }
      } else if (simRef.current) {
        simRef.current.oscillator.stop();
        simRef.current.audioContext.close().catch(() => {});
        simRef.current = null;
      }
      visualizerRef.current = null;
    };
  }, [audioGraph, lowPower]);

  // Load / blend to the chosen preset
  useEffect(() => {
    const visualizer = visualizerRef.current;
    const preset = presets[presetKey];
    if (!visualizer || !preset) return;
    visualizer.loadPreset(preset, loadedKeyRef.current ? BLEND_SECONDS : 0);
    loadedKeyRef.current = presetKey;
  }, [presets, presetKey, audioGraph, lowPower]);

  // Follow the container size (window resize, maximize, full screen, rotation)
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

  // Spotify audio-analysis for the simulated signal (may be unavailable for newer Spotify apps)
  useEffect(() => {
    analysisRef.current = null;
    if (audioGraph || !trackId || !getAudioAnalysis) return undefined;
    let cancelled = false;
    getAudioAnalysis(trackId)
      .then((data) => { if (!cancelled && data?.segments) analysisRef.current = data; })
      .catch(() => { /* fall back to the sine driver */ });
    return () => { cancelled = true; };
  }, [trackId, getAudioAnalysis, audioGraph]);

  // Render loop — paused entirely while the window is minimized or the tab is hidden
  useEffect(() => {
    if (!active) return undefined;
    const render = () => {
      const visualizer = visualizerRef.current;
      const sim = simRef.current;
      if (visualizer && !document.hidden) {
        if (sim) {
          const now = sim.audioContext.currentTime;
          if (liveRef.current.playing) {
            const analysis = analysisRef.current;
            const seconds = (liveRef.current.getPosition?.() || 0) / 1000;
            const segment = analysis?.segments.find((s) => seconds >= s.start && seconds < s.start + s.duration);
            if (segment) {
              const beat = analysis.beats.find((b) => seconds >= b.start && seconds < b.start + b.duration);
              const loudness = (Math.max(-60, segment.loudness_max) + 60) / 60;
              sim.gain.gain.setTargetAtTime(loudness * (beat ? 1.5 : 1), now, 0.05);
              const pitch = segment.pitches.indexOf(Math.max(...segment.pitches));
              sim.oscillator.frequency.setTargetAtTime(60 + pitch * 20, now, 0.1);
            } else {
              sim.gain.gain.setTargetAtTime(Math.sin(now * 0.5) * 0.2 + 0.5, now, 0.1);
            }
          } else {
            sim.gain.gain.setTargetAtTime(0.05, now, 0.3);
          }
        }
        visualizer.render();
      }
      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <div className="wmp-visualizer-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default Visualizer;
