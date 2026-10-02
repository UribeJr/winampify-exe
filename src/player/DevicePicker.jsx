import React, { useEffect, useState } from 'react';
import Dialog, { DialogButtons } from '../dialogs/Dialog';
import { useMusic } from '../music/MusicContext';

const DEVICE_ICONS = { Smartphone: '📱', Computer: '💻', Speaker: '🔊', TV: '📺', Tablet: '📱', CastAudio: '📡' };

// Spotify Connect device chooser (remote mode). Picking a device transfers playback to it.
const DevicePicker = ({ onClose }) => {
  const { devices, selectedDeviceId, controls } = useMusic();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await controls.refreshDevices();
    setRefreshing(false);
  };

  // Refresh once when opened
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Dialog title="Play On…" onClose={onClose} className="device-dialog">
      <p className="dialog-note">
        Winampify is running as a remote here. Choose where the music plays.
      </p>
      <ul className="device-list">
        {devices.length === 0 && !refreshing && (
          <li className="device-empty">
            No devices found. Open the Spotify app on this phone (or any computer or speaker),
            play something for a second, then tap Refresh.
          </li>
        )}
        {devices.map((device) => (
          <li key={device.id}>
            <button
              type="button"
              className={`device-row ${device.id === selectedDeviceId ? 'selected' : ''}`}
              onClick={() => {
                controls.transferTo(device.id);
                onClose();
              }}
              disabled={device.is_restricted}
            >
              <span className="device-icon" aria-hidden="true">{DEVICE_ICONS[device.type] || '🎵'}</span>
              <span className="device-name">{device.name}</span>
              {device.is_active && <span className="device-active">Active</span>}
            </button>
          </li>
        ))}
      </ul>
      <DialogButtons>
        <button type="button" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        <button type="button" onClick={onClose}>Close</button>
      </DialogButtons>
    </Dialog>
  );
};

export default DevicePicker;
