import React from 'react';
import SearchBox from './SearchBox';

// Desktop toolbar: navigation history, Home, the visualizer toggle, and library search.
// (Visualization choice lives on the visualizer's own strip, WMP 7 style.)
export const Toolbar = ({ canGoBack, canGoForward, onBack, onForward, onHome, viewMode, visualizerOn, onToggleVisualizer, onSearch, searchLabel, searchValue }) => (
  <div className="wmp-toolbar">
    <button type="button" className="toolbar-nav-btn" onClick={onBack} disabled={!canGoBack} title="Back" aria-label="Back">
      <span className="toolbar-icon toolbar-icon-back" />
    </button>
    <button type="button" className="toolbar-nav-btn" onClick={onForward} disabled={!canGoForward} title="Forward" aria-label="Forward">
      <span className="toolbar-icon toolbar-icon-forward" />
    </button>
    <button type="button" className="toolbar-nav-btn" onClick={onHome} title="Media Library home" aria-label="Home">
      <span className="toolbar-icon toolbar-icon-home" />
    </button>
    <div className="toolbar-separator" />
    <button
      type="button"
      className={`toolbar-nav-btn ${visualizerOn && viewMode === 'nowPlaying' ? 'active' : ''}`}
      onClick={onToggleVisualizer}
      title="Toggle Visualizer"
      aria-label="Toggle Visualizer"
    >
      <span className="toolbar-icon toolbar-icon-visualizer" />
    </button>
    {onSearch && <SearchBox onSearch={onSearch} initial={searchValue} label={searchLabel} className="toolbar-search" />}
  </div>
);

const VIEWS = [
  { id: 'nowPlaying', label: 'Now Playing', icon: 'music' },
  { id: 'mediaLibrary', label: 'Library', icon: 'folder' },
  { id: 'playlist', label: 'Playlist', icon: 'playlist' },
  { id: 'visualizer', label: 'Visualizer', icon: 'visualizer' }
];

// Phone replacement for the menu bar + toolbar: one row of 44px view tabs.
export const MobileViewBar = ({ viewMode, visualizerOn, onSelectView, onToggleVisualizer }) => {
  const current = viewMode === 'nowPlaying' && visualizerOn ? 'visualizer' : viewMode;
  return (
    <div className="mobile-view-bar">
      <div className="mobile-view-tabs" role="tablist">
        {VIEWS.map((view) => (
          <button
            type="button"
            role="tab"
            key={view.id}
            aria-selected={current === view.id}
            className={`mobile-view-tab ${current === view.id ? 'active' : ''}`}
            onClick={() => (view.id === 'visualizer' ? onToggleVisualizer(true) : onSelectView(view.id))}
          >
            <span className={`toolbar-icon toolbar-icon-${view.icon}`} aria-hidden="true" />
            <span>{view.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
