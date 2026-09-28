import React, { useState } from 'react';
import Dialog, { DialogButtons } from './Dialog';

const RunDialog = ({ onClose, onRun }) => {
  const [command, setCommand] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const value = command.trim();
    onClose();
    if (value) onRun(value);
  };

  return (
    <Dialog title="Run" onClose={onClose} className="run-dialog">
      <form onSubmit={submit}>
        <div className="dialog-message">
          <span className="dialog-icon icon-run-large" aria-hidden="true" />
          <label htmlFor="run-command">
            Type the name of a program, or paste a Spotify playlist link, and Winampify will open it for you.
          </label>
        </div>
        <div className="field-row dialog-field">
          <label htmlFor="run-command">Open:</label>
          <input
            id="run-command"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="wmp.exe"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
        </div>
        <DialogButtons>
          <button type="submit">OK</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </DialogButtons>
      </form>
    </Dialog>
  );
};

export default RunDialog;
