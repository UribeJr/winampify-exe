import React, { useState } from 'react';
import { useService } from '../music/MusicContext';
import { API_BASE_URL } from '../spotify/config';

export const SERVICE_DETAILS = {
  navidrome: {
    icon: 'cd',
    blurb: 'Your own library from a self-hosted Navidrome server. Plays right here, on desktop and phones.',
    setup: 'Not set up on this server — add NAVIDROME_URL, NAVIDROME_USERNAME and NAVIDROME_PASSWORD to .env.'
  },
  spotify: {
    icon: 'speaker',
    blurb: 'Your Spotify playlists and liked songs. Requires Spotify Premium.',
    setup: 'Not set up on this server — add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.'
  }
};

// "My Server (Navidrome)" when the server has its own display name
export const serviceLabel = (svc) => `${svc.name}${svc.id === 'navidrome' && svc.name !== 'Navidrome' ? ' (Navidrome)' : ''}`;

// Pick a service: Navidrome connects right away; Spotify goes to Spotify's sign-in page
export function startService(chooseProvider, id) {
  chooseProvider(id);
  if (id === 'spotify') window.location.href = `${API_BASE_URL}/login`;
}

/**
 * "Select your music service" list (Win98 option rows + Continue).
 * Navidrome connects immediately; Spotify goes straight to Spotify's sign-in page.
 */
const ServicePicker = ({ onCancel, continueLabel = 'Continue' }) => {
  const { services, config, chooseProvider } = useService();
  const firstAvailable = services.find((svc) => svc.id === config.provider && svc.configured)
    || services.find((svc) => svc.configured);
  const [selected, setSelected] = useState(firstAvailable?.id || null);

  const submit = (e) => {
    e.preventDefault();
    if (!selected) return;
    startService(chooseProvider, selected);
  };

  return (
    <form className="service-picker" onSubmit={submit}>
      <div className="service-list" role="radiogroup" aria-label="Music service">
        {services.map((svc) => {
          const details = SERVICE_DETAILS[svc.id];
          return (
            <label
              key={svc.id}
              className={`service-option ${selected === svc.id ? 'selected' : ''} ${svc.configured ? '' : 'disabled'}`}
            >
              <input
                type="radio"
                name="music-service"
                value={svc.id}
                checked={selected === svc.id}
                disabled={!svc.configured}
                onChange={() => setSelected(svc.id)}
              />
              <span className={`service-icon icon-${details.icon}`} aria-hidden="true" />
              <span className="service-text">
                <span className="service-name">{serviceLabel(svc)}</span>
                <span className="service-blurb">{svc.configured ? details.blurb : details.setup}</span>
              </span>
            </label>
          );
        })}
      </div>
      {!firstAvailable && (
        <p className="dialog-note">No music service is set up on this server yet. See .env.example, then restart the server.</p>
      )}
      <div className="dialog-buttons">
        <button type="submit" disabled={!selected} autoFocus>{continueLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
};

export default ServicePicker;
