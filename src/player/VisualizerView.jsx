import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import butterchurnPresets from 'butterchurn-presets';
import Visualizer from './Visualizer';
import ClassicVisualizer from './ClassicVisualizer';
import {
  BUILT_IN, AUTO_CHANGE_MS, libraryEntries, nextViz, prevViz, randomViz, restoreViz, groupViz, vizLabel,
  loadVizPrefs, saveVizPrefs
} from './visualizations';
import { artistNames, trackArt } from './utils';

const OVERLAY_MS = 5000;
const IDLE_MS = 3000;

// butterchurn-presets is large; this module only loads with the visualizer chunk
const PRESETS = butterchurnPresets.getPresets();
const LIST = [...BUILT_IN, ...libraryEntries(Object.keys(PRESETS))];

const canFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

/**
 * WMP 7-style visualizer: the visualization, a fading now-playing card, and a strip with
 * ◀ name ▶, a grouped picker, Random, Auto (change every 30 s) and Full Screen.
 */
const VisualizerView = ({ track, playing, active, audioGraph, getPosition, getAudioAnalysis, lowPower }) => {
  const [prefs, setPrefs] = useState(loadVizPrefs);
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const idleTimerRef = useRef(null);

  const current = useMemo(() => restoreViz(LIST, prefs.id), [prefs.id]);
  const groups = useMemo(() => groupViz(LIST), []);

  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      saveVizPrefs(next);
      return next;
    });
  }, []);
  const choose = useCallback((viz) => { update({ id: viz.id }); setMenuOpen(false); }, [update]);
  const step = useCallback((dir) => update({ id: (dir > 0 ? nextViz : prevViz)(LIST, current.id).id }), [update, current.id]);
  const random = useCallback(() => update({ id: randomViz(LIST, current.id).id }), [update, current.id]);

  // Auto-change while music plays
  useEffect(() => {
    if (!prefs.autoChange || !active || !playing) return undefined;
    const timer = setInterval(() => {
      setPrefs((p) => {
        const next = { ...p, id: randomViz(LIST, p.id).id };
        saveVizPrefs(next);
        return next;
      });
    }, AUTO_CHANGE_MS);
    return () => clearInterval(timer);
  }, [prefs.autoChange, active, playing]);

  // Now-playing card on track change
  const trackKey = track?.key || track?.id || null;
  useEffect(() => {
    if (!trackKey) return undefined;
    setOverlay(true);
    const timer = setTimeout(() => setOverlay(false), OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [trackKey]);

  // Full screen (native API, or a fixed full-window fallback e.g. on iOS Safari)
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (canFullscreen()) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else el.requestFullscreen().catch(() => setFullscreen((f) => !f));
    } else {
      setFullscreen((f) => !f);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // In full screen, hide the strip and cursor after a few idle seconds
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimerRef.current);
    if (fullscreen) idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, [fullscreen]);
  useEffect(() => {
    wake();
    return () => clearTimeout(idleTimerRef.current);
  }, [fullscreen, wake]);

  // Close the picker on outside click / Escape (Escape also leaves the fallback full screen)
  useEffect(() => {
    const onDown = (e) => { if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else if (fullscreen && !document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, fullscreen]);

  const onKeyDown = (e) => {
    if (e.target !== rootRef.current) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };

  const art = trackArt(track, 96);
  const overlayVisible = overlay || (fullscreen && !idle);

  return (
    <div
      ref={rootRef}
      className={`viz-view ${fullscreen ? 'is-fullscreen' : ''} ${fullscreen && !document.fullscreenElement ? 'pseudo-fullscreen' : ''} ${idle ? 'is-idle' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      aria-label={`Visualization: ${vizLabel(current)}. Use left and right arrows to change it.`}
    >
      <div className="viz-stage" onDoubleClick={toggleFullscreen}>
        {current.type === 'milkdrop' ? (
          <Visualizer
            presets={PRESETS}
            presetKey={current.presetKey}
            audioGraph={audioGraph}
            active={active}
            playing={playing}
            trackId={track?.id}
            getPosition={getPosition}
            getAudioAnalysis={getAudioAnalysis}
            lowPower={lowPower}
          />
        ) : (
          <ClassicVisualizer type={current.type} analyser={audioGraph?.analyser} active={active} playing={playing} lowPower={lowPower} />
        )}

        {track && (
          <div className={`viz-now-playing ${overlayVisible ? 'visible' : ''}`} aria-hidden={!overlayVisible}>
            {art && <img key={art} src={art} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            <div>
              <b>{track.title}</b>
              <span>{artistNames(track)}</span>
              {track.album?.name && <span className="viz-album">{track.album.name}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="viz-strip">
        <button type="button" className="viz-btn" onClick={() => step(-1)} title="Previous visualization" aria-label="Previous visualization">◀</button>
        <div className="viz-picker" ref={menuRef}>
          <button type="button" className="viz-name" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} title="Choose a visualization">
            {vizLabel(current)} <span aria-hidden="true">▴</span>
          </button>
          {menuOpen && (
            <div className="viz-menu" role="menu">
              {groups.map((group) => {
                const isLibrary = group.name === 'MilkDrop library';
                return (
                  <div key={group.name} className="viz-menu-group">
                    <button
                      type="button"
                      className="viz-menu-heading"
                      onClick={isLibrary ? () => setLibraryOpen((o) => !o) : undefined}
                      disabled={!isLibrary}
                    >
                      {group.name}{isLibrary ? ` (${group.items.length}) ${libraryOpen ? '▾' : '▸'}` : ''}
                    </button>
                    {(!isLibrary || libraryOpen) && (
                      <div className={isLibrary ? 'viz-menu-library' : ''}>
                        {group.items.map((viz) => (
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={viz.id === current.id}
                            key={viz.id}
                            className={`viz-menu-item ${viz.id === current.id ? 'checked' : ''}`}
                            onClick={() => choose(viz)}
                            title={viz.name}
                          >
                            {viz.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button type="button" className="viz-btn" onClick={() => step(1)} title="Next visualization" aria-label="Next visualization">▶</button>
        <span className="viz-strip-spacer" />
        <button type="button" className="viz-btn viz-text-btn" onClick={random} title="Random visualization">Random</button>
        <button
          type="button"
          className={`viz-btn viz-text-btn ${prefs.autoChange ? 'active' : ''}`}
          onClick={() => update({ autoChange: !prefs.autoChange })}
          aria-pressed={prefs.autoChange}
          title="Change visualization every 30 seconds"
        >
          Auto
        </button>
        <button type="button" className="viz-btn" onClick={toggleFullscreen} title={fullscreen ? 'Exit full screen' : 'Full screen'} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
          {fullscreen ? '🗗' : '⛶'}
        </button>
      </div>
    </div>
  );
};

export default VisualizerView;
