import React, { useState } from 'react';
import Dialog, { DialogButtons } from './Dialog';
import { noteTitle } from '../os/stickyNotes';

const formatDeleted = (ms) => {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Deleted sticky notes: restore one, or empty the bin (with a Win98-style confirmation).
const RecycleBinDialog = ({ trash, onRestore, onEmpty, onClose }) => {
  const [selectedId, setSelectedId] = useState(trash[0]?.id || null);
  const [confirming, setConfirming] = useState(false);
  const selected = trash.find((n) => n.id === selectedId) || null;

  const restore = () => {
    if (!selected) return;
    const index = trash.indexOf(selected);
    onRestore(selected.id);
    const next = trash[index + 1] || trash[index - 1];
    setSelectedId(next ? next.id : null);
  };

  return (
    <Dialog title="Recycle Bin" icon="recycle-bin" onClose={onClose} className="recycle-bin-dialog">
      {trash.length === 0 ? (
        <div className="dialog-message">
          <span className="dialog-icon icon-recycle-bin" aria-hidden="true" />
          <p>The Recycle Bin is empty.</p>
        </div>
      ) : (
        <div className="recycle-list" role="listbox" aria-label="Deleted notes">
          {trash.map((note) => (
            <button
              type="button"
              role="option"
              key={note.id}
              aria-selected={note.id === selectedId}
              className={`recycle-item ${note.id === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(note.id)}
              onDoubleClick={() => { setSelectedId(note.id); onRestore(note.id); }}
            >
              <span className={`recycle-swatch note-${note.color}`} aria-hidden="true" />
              <span className="recycle-name">{noteTitle(note)}</span>
              <span className="recycle-date">{formatDeleted(note.deletedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {confirming ? (
        <div className="recycle-confirm" role="alertdialog" aria-label="Confirm Empty Recycle Bin">
          <p>Are you sure you want to permanently delete {trash.length === 1 ? 'this note' : `these ${trash.length} notes`}?</p>
          <DialogButtons>
            <button type="button" onClick={() => { onEmpty(); setConfirming(false); setSelectedId(null); }} autoFocus>Yes</button>
            <button type="button" onClick={() => setConfirming(false)}>No</button>
          </DialogButtons>
        </div>
      ) : (
        <DialogButtons>
          <button type="button" onClick={restore} disabled={!selected}>Restore</button>
          <button type="button" onClick={() => setConfirming(true)} disabled={trash.length === 0}>Empty Recycle Bin</button>
          <button type="button" onClick={onClose}>Close</button>
        </DialogButtons>
      )}
    </Dialog>
  );
};

export default RecycleBinDialog;
