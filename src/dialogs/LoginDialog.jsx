import React from 'react';
import Dialog, { DialogButtons } from './Dialog';

// Win98 logon-style prompt shown after boot when there's no Spotify session.
const LoginDialog = ({ onLogin, onClose, remoteMode }) => (
  <Dialog title="Welcome to Winampify" onClose={onClose} className="login-dialog" closeOnBackdrop={false}>
    <div className="dialog-message">
      <span className="dialog-icon icon-login-large" aria-hidden="true" />
      <div>
        <p><b>Sign in with Spotify</b> to load your playlists, liked songs and albums.</p>
        <p className="dialog-note">
          {remoteMode
            ? 'On phones, Winampify works as a remote: music plays in your Spotify app while you control it here.'
            : 'Music plays right here in the browser. Spotify Premium is required.'}
        </p>
      </div>
    </div>
    <DialogButtons>
      <button type="button" onClick={onLogin} autoFocus>Sign In</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </DialogButtons>
  </Dialog>
);

export default LoginDialog;
