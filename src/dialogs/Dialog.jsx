import React, { useEffect } from 'react';

/**
 * Modal Win98 dialog frame shared by Run, Shut Down, Themes, message boxes and sign-in.
 * Escape and backdrop clicks close it; mobile sizing lives in CSS (.os-dialog).
 */
const Dialog = ({ title, icon, onClose, className = '', children, closeOnBackdrop = true }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`window os-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="title-bar">
          <div className="title-bar-text">
            {icon && <span className={`wmp-icon icon-${icon}`} aria-hidden="true" />}
            <span className="title-bar-label">{title}</span>
          </div>
          <div className="title-bar-controls">
            <button type="button" aria-label="Close" className="title-bar-button-mobile" onClick={onClose} />
          </div>
        </div>
        <div className="window-body os-dialog-body">{children}</div>
      </div>
    </div>
  );
};

export const DialogButtons = ({ children }) => <div className="dialog-buttons">{children}</div>;

export default Dialog;
