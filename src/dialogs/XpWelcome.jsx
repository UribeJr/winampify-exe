import React, { useEffect, useRef } from 'react';
import { useService } from '../music/MusicContext';
import { SERVICE_DETAILS, startService, serviceLabel } from './ServicePicker';

/**
 * XP-style "Welcome" screen (XP skin only): same choices as LoginDialog, shown as a full-screen
 * logon with one tile per music service. Click a tile to start; the chosen service's tile then
 * offers Connect/Retry, with Other Service and Cancel at the bottom.
 */
const XpWelcome = ({ music, onClose }) => {
  const { services, switchProvider, chooseProvider } = useService();
  const { provider, providerName, serverLabel, status, statusMessage, login } = music;
  const checking = status === 'checking';
  const rootRef = useRef(null);

  useEffect(() => {
    rootRef.current?.querySelector('.xp-tile:not(:disabled), .xp-go')?.focus();
  }, [provider]);

  const chosen = provider ? services.find((svc) => svc.id === provider) : null;

  return (
    <div className="xp-welcome" ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="xp-welcome-title">
      <div className="xp-welcome-band" />
      <div className="xp-welcome-main">
        <div className="xp-welcome-brand">
          <span className="xp-welcome-logo icon-cd-large" aria-hidden="true" />
          <h1 id="xp-welcome-title">Winampify</h1>
          <p>{chosen ? `Connect to ${chosen.id === 'navidrome' ? serverLabel : providerName} to start listening` : 'To begin, click your music service'}</p>
        </div>
        <div className="xp-welcome-divider" aria-hidden="true" />
        <div className="xp-welcome-tiles">
          {chosen ? (
            <div className="xp-tile is-chosen">
              <span className={`xp-tile-icon icon-${SERVICE_DETAILS[chosen.id].icon}`} aria-hidden="true" />
              <span className="xp-tile-text">
                <b>{serviceLabel(chosen)}</b>
                <span>
                  {checking ? 'Connecting…' : statusMessage
                    || (chosen.id === 'spotify' ? 'Sign in with your Spotify Premium account.' : 'Ready to connect.')}
                </span>
                <span className="xp-tile-actions">
                  <button type="button" className="xp-go" onClick={login} disabled={checking}>
                    {chosen.id === 'navidrome' ? (statusMessage ? 'Retry' : 'Connect') : 'Sign In'}
                    <span aria-hidden="true"> ➜</span>
                  </button>
                </span>
              </span>
            </div>
          ) : (
            services.map((svc) => {
              const details = SERVICE_DETAILS[svc.id];
              return (
                <button
                  type="button"
                  key={svc.id}
                  className="xp-tile"
                  disabled={!svc.configured}
                  onClick={() => startService(chooseProvider, svc.id)}
                >
                  <span className={`xp-tile-icon icon-${details.icon}`} aria-hidden="true" />
                  <span className="xp-tile-text">
                    <b>{serviceLabel(svc)}</b>
                    <span>{svc.configured ? details.blurb : details.setup}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="xp-welcome-band xp-welcome-foot">
        <button type="button" className="xp-welcome-off" onClick={onClose}>
          <span aria-hidden="true">⏻</span> Continue without music
        </button>
        {chosen && (
          <button type="button" className="xp-welcome-off" onClick={switchProvider}>Other Service…</button>
        )}
        <span className="xp-welcome-hint">You can switch services later from Start → Music Service.</span>
      </div>
    </div>
  );
};

export default XpWelcome;
