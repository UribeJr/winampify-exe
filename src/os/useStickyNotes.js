import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  EMPTY_STATE, createNote, updateNote, bringToFront, deleteNote, restoreNote, emptyTrash, normalize
} from './stickyNotes';

const STORAGE_KEY = 'winampify-sticky-notes';
const SAVE_DELAY_MS = 400; // typing saves are batched

const load = () => {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return EMPTY_STATE;
  }
};

/**
 * Desktop sticky notes + their Recycle Bin, kept in this browser's localStorage.
 * Returns { notes, trash, focusId, create, update, front, remove, restore, empty }.
 */
export default function useStickyNotes() {
  const [state, setState] = useState(load);
  const [focusId, setFocusId] = useState(null); // newly created note whose text box should take focus
  const stateRef = useRef(state);
  const timerRef = useRef(null);
  stateRef.current = state;

  const save = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    } catch {
      // storage full or blocked: notes still work for this visit
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, SAVE_DELAY_MS);
  }, [state, save]);

  // Don't lose the last few keystrokes when the tab closes
  useEffect(() => {
    const flush = () => { if (timerRef.current) save(); };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [save]);

  const actions = useMemo(() => ({
    create: (options) => {
      const { state: next, note } = createNote(stateRef.current, options);
      if (!note) return null;
      setState(next);
      setFocusId(note.id);
      return note.id;
    },
    update: (id, patch) => setState((s) => updateNote(s, id, patch)),
    front: (id) => setState((s) => bringToFront(s, id)),
    remove: (id) => setState((s) => deleteNote(s, id)),
    restore: (id) => setState((s) => restoreNote(s, id)),
    empty: () => setState((s) => emptyTrash(s)),
    clearFocus: () => setFocusId(null)
  }), []);

  return { notes: state.notes, trash: state.trash, focusId, ...actions };
}
