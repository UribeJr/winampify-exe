import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQ_BANDS, EQ_PRESETS, DEFAULT_EQ, MAX_DB, CUSTOM_PRESET, clampGain, bandLabel, matchPreset, normalizeEq,
  withGain, withPreset, preampDb, dbToGain, filterGains
} from '../src/music/equalizer.js';

test('every preset has one gain per band, within range, with a unique id', () => {
  const ids = new Set();
  EQ_PRESETS.forEach((p) => {
    assert.equal(p.gains.length, EQ_BANDS.length, p.id);
    assert.ok(p.gains.every((g) => Math.abs(g) <= MAX_DB), p.id);
    ids.add(p.id);
  });
  assert.equal(ids.size, EQ_PRESETS.length);
});

test('gains clamp to ±12 dB in half-dB steps; junk becomes 0', () => {
  assert.equal(clampGain(20), 12);
  assert.equal(clampGain(-99), -12);
  assert.equal(clampGain(3.3), 3.5);
  assert.equal(clampGain('abc'), 0);
  assert.equal(clampGain(undefined), 0);
});

test('band labels read like WMP', () => {
  assert.deepEqual(EQ_BANDS.map(bandLabel), ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']);
});

test('editing a band turns the preset into Custom; matching gains name the preset', () => {
  const rock = withPreset(DEFAULT_EQ, 'rock');
  assert.equal(rock.presetId, 'rock');
  const edited = withGain(rock, 0, 9);
  assert.equal(edited.presetId, CUSTOM_PRESET);
  assert.equal(edited.gains[0], 9);
  assert.equal(rock.gains[0], 5, 'original untouched');
  assert.equal(matchPreset(withGain(edited, 0, 5).gains), 'rock');
});

test('saved settings are normalized', () => {
  assert.deepEqual(normalizeEq(null), DEFAULT_EQ);
  const eq = normalizeEq({ enabled: 1, gains: [50, 'x', 2] });
  assert.equal(eq.enabled, true);
  assert.equal(eq.gains.length, EQ_BANDS.length);
  assert.deepEqual(eq.gains.slice(0, 4), [12, 0, 2, 0]);
  assert.equal(eq.presetId, CUSTOM_PRESET);
});

test('bypass zeroes the filters and preamp; enabled boosts get headroom', () => {
  const bass = withPreset({ ...DEFAULT_EQ, enabled: true }, 'bass');
  assert.equal(preampDb(bass), -3.5);
  assert.deepEqual(filterGains(bass), bass.gains);
  const off = { ...bass, enabled: false };
  assert.equal(preampDb(off), 0);
  assert.ok(filterGains(off).every((g) => g === 0));
  assert.equal(preampDb(withPreset({ ...DEFAULT_EQ, enabled: true }, 'flat')), 0);
  assert.ok(Math.abs(dbToGain(-6) - 0.501) < 0.001);
});
