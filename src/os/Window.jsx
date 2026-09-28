import React, { useRef } from 'react';
import Draggable from 'react-draggable';

const EDGE = 8; // keep at least this much of a window inside the desktop

const TitleButton = ({ label, onPress }) => (
  <button
    type="button"
    aria-label={label}
    className="title-bar-button-mobile"
    onClick={(e) => {
      e.stopPropagation();
      onPress();
    }}
  />
);

/**
 * Draggable Win98 window. Maximized (always, on phones) it fills the desktop area;
 * otherwise its size and position are clamped to the current viewport so rotation/resizes never strand it.
 */
const Window = ({
  id,
  title,
  icon,
  isActive,
  isMinimized,
  isMaximized,
  forceMaximized,
  zIndex,
  position,
  size,
  desktopSize,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onMove,
  children
}) => {
  const nodeRef = useRef(null);
  const maximized = isMaximized || forceMaximized;

  const width = Math.min(size.width, desktopSize.width - EDGE * 2);
  const height = Math.min(size.height, desktopSize.height - EDGE * 2);
  const clampedPosition = {
    x: Math.min(Math.max(position.x, 0), Math.max(0, desktopSize.width - width)),
    y: Math.min(Math.max(position.y, 0), Math.max(0, desktopSize.height - height))
  };

  const classes = [
    'window',
    'os-window',
    isActive ? 'active' : 'inactive',
    maximized ? 'maximized' : '',
    isMinimized ? 'minimized' : ''
  ].filter(Boolean).join(' ');

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".title-bar"
      cancel=".title-bar-controls"
      bounds="parent"
      position={maximized ? { x: 0, y: 0 } : clampedPosition}
      disabled={maximized || isMinimized}
      onStart={() => onFocus(id)}
      onStop={(e, data) => onMove(id, { x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className={classes}
        style={{
          zIndex,
          width: maximized ? '100%' : width,
          height: maximized ? '100%' : height
        }}
        onPointerDownCapture={() => onFocus(id)}
        aria-hidden={isMinimized || undefined}
      >
        <div
          className={`title-bar ${isActive ? '' : 'inactive'}`}
          onDoubleClick={forceMaximized ? undefined : () => onToggleMaximize(id)}
        >
          <div className="title-bar-text">
            {icon && <span className={`wmp-icon icon-${icon}`} aria-hidden="true" />}
            <span className="title-bar-label">{title}</span>
          </div>
          <div className="title-bar-controls">
            <TitleButton label="Minimize" onPress={() => onMinimize(id)} />
            {!forceMaximized && (
              <TitleButton label={isMaximized ? 'Restore' : 'Maximize'} onPress={() => onToggleMaximize(id)} />
            )}
            <TitleButton label="Close" onPress={() => onClose(id)} />
          </div>
        </div>
        <div className="window-body">{children}</div>
      </div>
    </Draggable>
  );
};

export default Window;
