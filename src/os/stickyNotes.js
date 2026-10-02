// Pure sticky-note state helpers (no React, no storage) so they're easy to unit test.
// State: { version: 1, notes: Note[], trash: TrashedNote[] }
//   Note        = { id, text, color, x, y, collapsed, z }
//   TrashedNote = Note & { deletedAt }

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green'];
export const NOTE_SIZE = { width: 190, height: 170, titleHeight: 20 };
export const LIMITS = { textLength: 4000, notes: 100, trash: 50 };

export const EMPTY_STATE = { version: 1, notes: [], trash: [] };

const newId = () => `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const topZ = (notes) => notes.reduce((max, n) => Math.max(max, n.z || 0), 0);

const clampText = (text) => String(text ?? '').slice(0, LIMITS.textLength);

// First non-empty line, for title bars and the Recycle Bin list
export const noteTitle = (note) => {
  const line = (note?.text || '').split('\n').find((l) => l.trim());
  return line ? line.trim().slice(0, 60) : 'Sticky Note';
};

export function createNote(state, { x = 0, y = 0, color = 'yellow', id = newId() } = {}) {
  if (state.notes.length >= LIMITS.notes) return { state, note: null };
  const note = {
    id,
    text: '',
    color: NOTE_COLORS.includes(color) ? color : 'yellow',
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    collapsed: false,
    z: topZ(state.notes) + 1
  };
  return { state: { ...state, notes: [...state.notes, note] }, note };
}

export function updateNote(state, id, patch) {
  const allowed = {};
  if ('text' in patch) allowed.text = clampText(patch.text);
  if ('color' in patch && NOTE_COLORS.includes(patch.color)) allowed.color = patch.color;
  if ('collapsed' in patch) allowed.collapsed = Boolean(patch.collapsed);
  if ('x' in patch) allowed.x = Math.max(0, Math.round(patch.x));
  if ('y' in patch) allowed.y = Math.max(0, Math.round(patch.y));
  return { ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, ...allowed } : n)) };
}

export function bringToFront(state, id) {
  const note = state.notes.find((n) => n.id === id);
  const z = topZ(state.notes);
  if (!note || (note.z === z && state.notes.filter((n) => n.z === z).length === 1)) return state;
  return { ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, z: z + 1 } : n)) };
}

// Moves a note to the Recycle Bin. Blank notes are simply discarded.
export function deleteNote(state, id, now = Date.now()) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return state;
  const notes = state.notes.filter((n) => n.id !== id);
  if (!note.text.trim()) return { ...state, notes };
  const trash = [{ ...note, deletedAt: now }, ...state.trash].slice(0, LIMITS.trash);
  return { ...state, notes, trash };
}

export function restoreNote(state, id) {
  const item = state.trash.find((n) => n.id === id);
  if (!item || state.notes.length >= LIMITS.notes) return state;
  const { deletedAt, ...note } = item;
  return {
    ...state,
    notes: [...state.notes, { ...note, z: topZ(state.notes) + 1 }],
    trash: state.trash.filter((n) => n.id !== id)
  };
}

export const emptyTrash = (state) => ({ ...state, trash: [] });

const validNote = (n) => n && typeof n.id === 'string' && typeof n.text === 'string';

const cleanNote = (n) => ({
  id: n.id,
  text: clampText(n.text),
  color: NOTE_COLORS.includes(n.color) ? n.color : 'yellow',
  x: Number.isFinite(n.x) ? Math.max(0, n.x) : 0,
  y: Number.isFinite(n.y) ? Math.max(0, n.y) : 0,
  collapsed: Boolean(n.collapsed),
  z: Number.isFinite(n.z) ? n.z : 1
});

// Accepts whatever came out of storage and returns a valid state
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_STATE;
  const notes = Array.isArray(raw.notes) ? raw.notes.filter(validNote).slice(0, LIMITS.notes).map(cleanNote) : [];
  const trash = Array.isArray(raw.trash)
    ? raw.trash.filter(validNote).slice(0, LIMITS.trash)
      .map((n) => ({ ...cleanNote(n), deletedAt: Number.isFinite(n.deletedAt) ? n.deletedAt : 0 }))
    : [];
  return { version: 1, notes, trash };
}
