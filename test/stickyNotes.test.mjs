import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_STATE, LIMITS, createNote, updateNote, bringToFront, deleteNote, restoreNote, emptyTrash, normalize, noteTitle
} from '../src/os/stickyNotes.js';

const withNote = (text = 'Buy milk', options = {}) => {
  const { state, note } = createNote(EMPTY_STATE, { x: 40, y: 60, ...options });
  return { state: updateNote(state, note.id, { text }), id: note.id };
};

test('createNote places a yellow note on top', () => {
  const first = createNote(EMPTY_STATE, { x: 10.6, y: -5 });
  assert.deepEqual(
    { x: first.note.x, y: first.note.y, color: first.note.color, collapsed: first.note.collapsed },
    { x: 11, y: 0, color: 'yellow', collapsed: false }
  );
  const second = createNote(first.state, { color: 'pink' });
  assert.equal(second.note.color, 'pink');
  assert.ok(second.note.z > first.note.z);
});

test('updateNote only accepts known fields and clamps text', () => {
  const { state, id } = withNote();
  const next = updateNote(state, id, { color: 'neon', collapsed: 1, text: 'x'.repeat(LIMITS.textLength + 10), z: 999 });
  const note = next.notes[0];
  assert.equal(note.color, 'yellow');
  assert.equal(note.collapsed, true);
  assert.equal(note.text.length, LIMITS.textLength);
  assert.notEqual(note.z, 999);
});

test('bringToFront raises a note above the others', () => {
  const a = createNote(EMPTY_STATE);
  const b = createNote(a.state);
  const raised = bringToFront(b.state, a.note.id);
  const za = raised.notes.find((n) => n.id === a.note.id).z;
  const zb = raised.notes.find((n) => n.id === b.note.id).z;
  assert.ok(za > zb);
});

test('deleting moves a note to the trash; blank notes are discarded', () => {
  const { state, id } = withNote('Call mom');
  const deleted = deleteNote(state, id, 1234);
  assert.equal(deleted.notes.length, 0);
  assert.equal(deleted.trash[0].deletedAt, 1234);

  const blank = createNote(EMPTY_STATE);
  const discarded = deleteNote(updateNote(blank.state, blank.note.id, { text: '   ' }), blank.note.id);
  assert.equal(discarded.notes.length, 0);
  assert.equal(discarded.trash.length, 0);
});

test('restoreNote puts it back where it was; emptyTrash clears the bin', () => {
  const { state, id } = withNote('Groceries', { color: 'green' });
  const restored = restoreNote(deleteNote(state, id), id);
  assert.equal(restored.trash.length, 0);
  assert.deepEqual(
    { x: restored.notes[0].x, y: restored.notes[0].y, color: restored.notes[0].color, text: restored.notes[0].text },
    { x: 40, y: 60, color: 'green', text: 'Groceries' }
  );
  assert.equal('deletedAt' in restored.notes[0], false);
  assert.equal(emptyTrash(deleteNote(state, id)).trash.length, 0);
});

test('note and trash limits are enforced', () => {
  let state = EMPTY_STATE;
  for (let i = 0; i < LIMITS.notes; i += 1) state = createNote(state).state;
  assert.equal(createNote(state).note, null);

  let trashState = EMPTY_STATE;
  for (let i = 0; i < LIMITS.trash + 5; i += 1) {
    const { state: s, note } = createNote(trashState);
    trashState = deleteNote(updateNote(s, note.id, { text: `n${i}` }), note.id);
  }
  assert.equal(trashState.trash.length, LIMITS.trash);
  assert.equal(trashState.trash[0].text, `n${LIMITS.trash + 4}`); // newest first
});

test('normalize repairs bad stored data', () => {
  assert.deepEqual(normalize(null), EMPTY_STATE);
  assert.deepEqual(normalize('nope'), EMPTY_STATE);
  const state = normalize({
    notes: [{ id: 'a', text: 'ok', color: 'purple', x: -4, y: 'bad' }, { text: 'no id' }, null],
    trash: [{ id: 'b', text: 'old' }]
  });
  assert.equal(state.notes.length, 1);
  assert.deepEqual({ color: state.notes[0].color, x: state.notes[0].x, y: state.notes[0].y }, { color: 'yellow', x: 0, y: 0 });
  assert.equal(state.trash[0].deletedAt, 0);
});

test('noteTitle uses the first non-empty line', () => {
  assert.equal(noteTitle({ text: '\n  Shopping list \n- eggs' }), 'Shopping list');
  assert.equal(noteTitle({ text: '' }), 'Sticky Note');
});
