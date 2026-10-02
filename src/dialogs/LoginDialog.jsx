import React from 'react';
import Dialog, { DialogButtons } from './Dialog';

// Win98 logon-style prompt shown after boot when there's no music session.
// Navidrome: the server holds the credentials, so this just (re)connects and explains failures.
const LoginDialog = ({ music, onClose }) => {
  const { provider, providerName, serverLabel, status, statusMessage, login, mode } = music;
  const checking = status === 'checking';

  return (
    <Dialog title="Welcome to Winampify" onClose={onClose} className="login-dialog" closeOnBackdrop={false}>
      <div className="dialog-message">
        <span className="dialog-icon icon-login-large" aria-hidden="true" />
        {provider === 'navidrome' ? (
          <div>
            <p><b>Connect to {serverLabel}</b> to browse your {providerName} library.</p>
            {statusMessage && !checking && <p className="dialog-note" role="status">{statusMessage}</p>}
            {checking && <p className="dialog-note" role="status">Connecting…</p>}
          </div>
        ) : (
          <div>
            <p><b>Sign in with Spotify</b> to load your playlists, liked songs and albums.</p>
            <p className="dialog-note">
              {mode === 'connect'
                ? 'On phones, Winampify works as a remote: music plays in your Spotify app while you control it here.'
                : 'Music plays right here in the browser. Spotify Premium is required.'}
            </p>
          </div>
        )}
      </div>
      <DialogButtons>
        <button type="button" onClick={login} disabled={checking} autoFocus>
          {provider === 'navidrome' ? (statusMessage ? 'Retry' : 'Connect') : 'Sign In'}
        </button>
        <button type="button" onClick={onClose}>Cancel</button>
      </DialogButtons>
    </Dialog>
  );
};

export default LoginDialog;
