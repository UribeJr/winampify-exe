import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleServices } from '../src/music/services.js';

const nd = (configured) => ({ id: 'navidrome', name: 'Navidrome', configured });
const sp = (configured) => ({ id: 'spotify', name: 'Spotify', configured });

test('only configured services are offered', () => {
  assert.deepEqual(visibleServices([nd(false), sp(true)]).map((s) => s.id), ['spotify']);
  assert.deepEqual(visibleServices([nd(true), sp(true)]).map((s) => s.id), ['navidrome', 'spotify']);
});

test('with nothing configured, every service is listed (with its setup hint)', () => {
  assert.deepEqual(visibleServices([nd(false), sp(false)]).map((s) => s.id), ['navidrome', 'spotify']);
  assert.deepEqual(visibleServices([]), []);
});
