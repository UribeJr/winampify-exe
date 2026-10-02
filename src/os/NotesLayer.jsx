import React, { useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import useLongPress from '../hooks/useLongPress';
import { noteTitle } from './stickyNotes';

// Expanded note size; phones get a slightly larger note (bigger text, 44px buttons)
export const noteSize = (isMobile) => (isMobile ? { width: 220, height: 200, title: 34 } : { width: 190, height: 170, title: 20 });

const StickyNote = ({ note, size, bounds, autoFocus, onFocused, onUpdate, onFront, onDelete, onMenu }) => {
  const nodeRef = useRef(null);
  const textRef = useRef(null);
  const height = note.collapsed ? size.title + 6 : size.height;

  // Keep notes reachable after the desktop shrinks (window resize, phone rotation)
  const position = {
    x: Math.min(note.x, Math.max(0, bounds.width - size.width)),
    y: Math.min(note.y, Math.max(0, bounds.height - height))
  };

  useEffect(() => {
    if (!autoFocus) return;
    textRef.current?.focus();
    onFocused();
  }, [autoFocus, onFocused]);

  const openMenu = useCallback((x, y) => onMenu(x, y, note), [onMenu, note]);
  const longPress = useLongPress(openMenu);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".sticky-note-title"
      cancel=".sticky-note-btn"
      bounds="parent"
      position={position}
      onStart={() => onFront(note.id)}
      onStop={(e, data) => {
        if (data.x !== position.x || data.y !== position.y) onUpdate(note.id, { x: data.x, y: data.y });
      }}
    >
      <div
        ref={nodeRef}
        className={`sticky-note note-${note.color} ${note.collapsed ? 'collapsed' : ''}`}
        style={{ width: size.width, height, zIndex: note.z }}
        onPointerDownCapture={() => onFront(note.id)}
        role="group"
        aria-label={`Sticky note: ${noteTitle(note)}`}
      >
        <div
          className="sticky-note-title"
          style={{ height: size.title }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openMenu(e.clientX, e.clientY);
          }}
          onDoubleClick={() => onUpdate(note.id, { collapsed: !note.collapsed })}
          {...longPress}
        >
          <span className="sticky-note-label">{noteTitle(note)}</span>
          <button
            type="button"
            className="sticky-note-btn"
            aria-label={note.collapsed ? 'Expand note' : 'Collapse note'}
            title={note.collapsed ? 'Expand' : 'Collapse'}
            onClick={() => onUpdate(note.id, { collapsed: !note.collapsed })}
          >
            {note.collapsed ? '▾' : '▴'}
          </button>
          <button
            type="button"
            className="sticky-note-btn"
            aria-label="Delete note"
            title="Delete (moves to the Recycle Bin)"
            onClick={() => onDelete(note.id)}
          >
            ×
          </button>
        </div>
        {!note.collapsed && (
          <textarea
            ref={textRef}
            className="sticky-note-text"
            value={note.text}
            placeholder="Type a note…"
            aria-label="Note text"
            spellCheck
            onChange={(e) => onUpdate(note.id, { text: e.target.value })}
          />
        )}
      </div>
    </Draggable>
  );
};

/**
 * Sticky notes on the desktop, between the icons and app windows.
 * Positions are desktop px; the layer is the drag bounds.
 */
const NotesLayer = ({ notes, isMobile, bounds, focusId, onFocused, onUpdate, onFront, onDelete, onMenu }) => {
  const size = noteSize(isMobile);
  return (
    <div className="notes-layer">
      {notes.map((note) => (
        <StickyNote
          key={note.id}
          note={note}
          size={size}
          bounds={bounds}
          autoFocus={focusId === note.id}
          onFocused={onFocused}
          onUpdate={onUpdate}
          onFront={onFront}
          onDelete={onDelete}
          onMenu={onMenu}
        />
      ))}
    </div>
  );
};

export default NotesLayer;
