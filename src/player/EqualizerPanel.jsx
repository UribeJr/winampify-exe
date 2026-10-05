import React, { useId } from 'react';
import { useMusic } from '../music/MusicContext';
import { EQ_BANDS, EQ_PRESETS, MAX_DB, CUSTOM_PRESET, bandLabel } from '../music/equalizer';

const formatDb = (db) => `${db > 0 ? '+' : ''}${db} dB`;

/**
 * WMP 7-style Graphic Equalizer, docked above the controls (desktop).
 * Settings live in the audio engine; sliders are native ranges, so arrow keys work.
 */
const EqualizerPanel = ({ onClose }) => {
  const { equalizer, providerName } = useMusic();
  const toggleId = useId();

  const header = (
    <div className="wmp-now-playing-pane-header eq-header">
      <span>Graphic Equalizer</span>
      <button type="button" className="pane-close" onClick={onClose} aria-label="Hide Graphic Equalizer">×</button>
    </div>
  );

  if (!equalizer?.supported) {
    return (
      <section className="eq-panel" aria-label="Graphic Equalizer">
        {header}
        <p className="eq-unavailable">
          {equalizer
            ? 'The equalizer works on a computer. Phones play music without audio processing so it keeps going with the screen locked.'
            : `The equalizer needs audio the browser can process. ${providerName || 'This service'}'s audio is protected, so it works with Navidrome only.`}
        </p>
      </section>
    );
  }

  const { settings, setEnabled, setGain, setPreset, reset } = equalizer;

  return (
    <section className={`eq-panel ${settings.enabled ? '' : 'is-off'}`} aria-label="Graphic Equalizer">
      {header}
      <div className="eq-body">
        <div className="eq-options">
          <div className="eq-toggle">
            <input id={toggleId} type="checkbox" checked={settings.enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <label htmlFor={toggleId}>On</label>
          </div>
          <label className="eq-preset">
            <span>Preset:</span>
            <select value={settings.presetId} onChange={(e) => setPreset(e.target.value)}>
              {EQ_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              {settings.presetId === CUSTOM_PRESET && <option value={CUSTOM_PRESET} disabled>Custom</option>}
            </select>
          </label>
          <button type="button" className="eq-reset" onClick={reset}>Reset</button>
        </div>

        <div className="eq-bands">
          <div className="eq-scale" aria-hidden="true">
            <span>+{MAX_DB}</span>
            <span>0</span>
            <span>−{MAX_DB}</span>
          </div>
          {EQ_BANDS.map((hz, i) => {
            const db = settings.gains[i];
            const name = `${bandLabel(hz)}Hz`;
            return (
              <div className="eq-band" key={hz}>
                <input
                  type="range"
                  className="eq-slider"
                  min={-MAX_DB}
                  max={MAX_DB}
                  step={0.5}
                  value={db}
                  onChange={(e) => setGain(i, Number(e.target.value))}
                  onDoubleClick={() => setGain(i, 0)}
                  aria-label={`${name} band`}
                  aria-valuetext={formatDb(db)}
                  title={`${name}: ${formatDb(db)} (double-click to reset)`}
                />
                <span className="eq-band-label">{bandLabel(hz)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EqualizerPanel;
