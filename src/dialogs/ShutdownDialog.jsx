import React, { useState } from 'react';
import Dialog, { DialogButtons } from './Dialog';

const OPTIONS = [
  { value: 'shutdown', label: 'Shut down (sign out of Spotify)' },
  { value: 'restart', label: 'Restart Winampify' }
];

const ShutdownDialog = ({ onClose, onChoose, isAuthenticated }) => {
  const options = isAuthenticated ? OPTIONS : OPTIONS.filter((o) => o.value !== 'shutdown');
  const [selected, setSelected] = useState(options[0].value);

  const submit = (e) => {
    e.preventDefault();
    onClose();
    onChoose(selected);
  };

  return (
    <Dialog title="Shut Down Windows" onClose={onClose} className="shutdown-dialog">
      <form onSubmit={submit}>
        <div className="dialog-message">
          <span className="dialog-icon icon-shutdown-large" aria-hidden="true" />
          <span>What do you want the computer to do?</span>
        </div>
        <div className="dialog-options">
          {options.map((option) => (
            <div className="field-row" key={option.value}>
              <input
                id={`shutdown-${option.value}`}
                type="radio"
                name="shutdown-option"
                value={option.value}
                checked={selected === option.value}
                onChange={() => setSelected(option.value)}
              />
              <label htmlFor={`shutdown-${option.value}`}>{option.label}</label>
            </div>
          ))}
        </div>
        <DialogButtons>
          <button type="submit">OK</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </DialogButtons>
      </form>
    </Dialog>
  );
};

export default ShutdownDialog;
