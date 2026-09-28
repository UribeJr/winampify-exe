import React from 'react';
import Dialog, { DialogButtons } from './Dialog';

const ICONS = { info: 'ℹ️', warning: '⚠️', error: '⛔' };

/**
 * message: string, or { intro, bullets: [] }
 */
const MessageDialog = ({ title = 'Winampify', message, type = 'info', onClose }) => {
  const { intro, bullets = [] } = typeof message === 'string' ? { intro: message } : message;

  return (
    <Dialog title={title} onClose={onClose} className="message-dialog">
      <div className="dialog-message">
        <span className="dialog-icon dialog-icon-emoji" aria-hidden="true">{ICONS[type] || ICONS.info}</span>
        <div>
          {intro && <p>{intro}</p>}
          {bullets.length > 0 && (
            <ul className="dialog-bullets">
              {bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
      </div>
      <DialogButtons>
        <button type="button" onClick={onClose} autoFocus>OK</button>
      </DialogButtons>
    </Dialog>
  );
};

export default MessageDialog;
