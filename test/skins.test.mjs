import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, DEFAULT_SKIN, XP_SCHEMES, normalizeSkin, getSchemesForSkin, defaultSchemeFor, resolveScheme } from '../src/data/skins.js';
import { getThemeList } from '../src/data/themes.js';

test('98 is the default skin; unknown skins fall back to it', () => {
  assert.equal(DEFAULT_SKIN, '98');
  assert.deepEqual(SKINS.map((s) => s.id), ['98', 'xp']);
  assert.equal(normalizeSkin('xp'), 'xp');
  assert.equal(normalizeSkin('vista'), '98');
  assert.equal(normalizeSkin(null), '98');
});

test('each skin lists its own color schemes', () => {
  assert.deepEqual(getSchemesForSkin('98').map((s) => s.id), getThemeList().map((t) => t.id));
  assert.deepEqual(getSchemesForSkin('xp').map((s) => s.id), ['xp-blue', 'xp-olive', 'xp-silver']);
  assert.equal(defaultSchemeFor('xp'), 'xp-blue');
  assert.equal(defaultSchemeFor('98'), 'default');
});

test('a saved scheme is only kept when it belongs to the skin', () => {
  assert.equal(resolveScheme('xp', 'xp-olive'), 'xp-olive');
  assert.equal(resolveScheme('xp', 'rose'), 'xp-blue');
  assert.equal(resolveScheme('98', 'rose'), 'rose');
  assert.equal(resolveScheme('98', 'xp-silver'), 'default');
  assert.equal(resolveScheme('98', undefined), 'default');
  assert.ok(XP_SCHEMES.every((s) => s.preview.title && s.preview.taskbar));
});
