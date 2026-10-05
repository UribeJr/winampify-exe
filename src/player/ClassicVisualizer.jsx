import React, { useRef, useEffect } from 'react';

const BAR_COUNT = 24;
const SEGMENT = 6; // px per LED segment in Bars and Waves
const PEAK_FALL = 0.012; // peak caps fall this fraction of the height per frame
const SIM_BINS = 1024;

// Log-spaced frequency bands, so bass and treble both get a fair share of bars
const bandEdges = (count, bins) => {
  const min = 2;
  const max = Math.min(bins - 1, 480);
  return Array.from({ length: count + 1 }, (_, i) => Math.round(min * (max / min) ** (i / count)));
};
const EDGES = bandEdges(BAR_COUNT, SIM_BINS);

// A believable fake spectrum/waveform when we can't hear the music (Spotify, phones)
function simulate(freq, wave, t, playing) {
  const energy = playing ? 1 : 0;
  const kick = playing ? Math.max(0, Math.sin(t * 7.5)) ** 8 : 0;
  for (let i = 0; i < freq.length; i += 1) {
    const x = i / freq.length;
    const base = (1 - x) ** 1.6 * 150 * energy;
    const wobble = (Math.sin(t * 3 + i * 0.05) * 0.5 + 0.5) * 50 * energy;
    freq[i] = Math.min(255, base + wobble + kick * 60 * (1 - x) + Math.random() * 18 * energy);
  }
  for (let i = 0; i < wave.length; i += 1) {
    const x = i / wave.length;
    const v = playing ? Math.sin(x * Math.PI * 8 + t * 6) * 0.35 + Math.sin(x * Math.PI * 21 + t * 2) * 0.15 : 0;
    wave[i] = 128 + v * 127;
  }
}

const bandLevel = (freq, i) => {
  let sum = 0;
  const from = EDGES[i];
  const to = Math.max(EDGES[i + 1], from + 1);
  for (let b = from; b < to; b += 1) sum += freq[b] || 0;
  return sum / (to - from) / 255;
};

function drawBars(ctx, w, h, freq, peaks) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const gap = Math.max(2, Math.round(w / BAR_COUNT / 6));
  const barW = (w - gap * (BAR_COUNT + 1)) / BAR_COUNT;
  const segments = Math.floor(h / SEGMENT);
  for (let i = 0; i < BAR_COUNT; i += 1) {
    const level = bandLevel(freq, i);
    const lit = Math.round(level * segments);
    const x = gap + i * (barW + gap);
    for (let s = 0; s < lit; s += 1) {
      const frac = s / segments;
      ctx.fillStyle = frac > 0.8 ? '#ff3b30' : frac > 0.55 ? '#ffd60a' : '#30d158';
      ctx.fillRect(x, h - (s + 1) * SEGMENT + 1, barW, SEGMENT - 2);
    }
    peaks[i] = Math.max(level, (peaks[i] || 0) - PEAK_FALL);
    const py = h - Math.round(peaks[i] * segments) * SEGMENT - 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, Math.max(0, py), barW, 2);
  }
}

function drawScope(ctx, w, h, wave) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(48, 209, 88, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += h / 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#39ff6a';
  ctx.lineWidth = Math.max(2, h / 200);
  ctx.shadowColor = '#39ff6a';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < wave.length; i += 1) {
    const x = (i / (wave.length - 1)) * w;
    const y = (wave[i] / 255) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawDots(ctx, w, h, freq, t) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // trails
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const bass = bandLevel(freq, 1);
  const base = Math.min(w, h) * (0.18 + bass * 0.14);
  const rings = 3;
  for (let r = 0; r < rings; r += 1) {
    const count = 36 + r * 12;
    for (let i = 0; i < count; i += 1) {
      const band = Math.floor((i / count) * BAR_COUNT);
      const level = bandLevel(freq, band);
      const angle = (i / count) * Math.PI * 2 + t * (0.3 + r * 0.15) * (r % 2 ? -1 : 1);
      const radius = base * (1 + r * 0.45) + level * Math.min(w, h) * 0.08;
      const size = 2 + level * 7;
      ctx.fillStyle = `hsl(${(t * 40 + i * 6 + r * 60) % 360}, 90%, ${45 + level * 30}%)`;
      ctx.fillRect(cx + Math.cos(angle) * radius - size / 2, cy + Math.sin(angle) * radius - size / 2, size, size);
    }
  }
}

/**
 * Classic visualizations drawn on a 2D canvas: Bars and Waves, Scope and Dots.
 * Uses the real analyser when given one (Navidrome on desktop), otherwise a simulated signal.
 */
const ClassicVisualizer = ({ type, analyser, active, playing, lowPower }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = { playing };

  // Size the canvas to the container at device resolution
  useEffect(() => {
    const el = containerRef.current;
    const ratio = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      canvasRef.current.width = Math.max(1, Math.round(width * ratio));
      canvasRef.current.height = Math.max(1, Math.round(height * ratio));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [lowPower]);

  useEffect(() => {
    if (!active) return undefined;
    const ctx = canvasRef.current.getContext('2d');
    const bins = analyser ? analyser.frequencyBinCount : SIM_BINS;
    const freq = new Uint8Array(bins);
    const wave = new Uint8Array(analyser ? analyser.fftSize : 2048);
    const peaks = [];
    const start = performance.now();
    let frame;
    const draw = (now) => {
      if (!document.hidden) {
        const t = (now - start) / 1000;
        if (analyser) {
          analyser.getByteFrequencyData(freq);
          analyser.getByteTimeDomainData(wave);
        } else {
          simulate(freq, wave, t, liveRef.current.playing);
        }
        const { width: w, height: h } = canvasRef.current;
        if (type === 'scope') drawScope(ctx, w, h, wave);
        else if (type === 'dots') drawDots(ctx, w, h, freq, t);
        else drawBars(ctx, w, h, freq, peaks);
      }
      frame = requestAnimationFrame(draw);
    };
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [type, analyser, active]);

  return (
    <div className="wmp-visualizer-container" ref={containerRef}>
      <canvas ref={canvasRef} className={`classic-viz classic-${type}`} />
    </div>
  );
};

export default ClassicVisualizer;
