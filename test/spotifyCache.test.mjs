import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/music/spotify/cache.js';

test('one request per key while fresh; a new one after the TTL', async () => {
  let clock = 0;
  const cache = createCache({ now: () => clock });
  let calls = 0;
  const load = async () => ++calls;
  const [a, b] = await Promise.all([cache.get('k', 100, load), cache.get('k', 100, load)]);
  assert.deepEqual([a, b, calls], [1, 1, 1]);
  clock = 99;
  assert.equal(await cache.get('k', 100, load), 1);
  clock = 100;
  assert.equal(await cache.get('k', 100, load), 2);
});

test('failures are not kept, so the next ask retries', async () => {
  const cache = createCache();
  let calls = 0;
  await assert.rejects(cache.get('k', 1000, async () => { calls += 1; throw new Error('boom'); }));
  assert.equal(await cache.get('k', 1000, async () => ++calls), 2);
});

test('invalidate drops keys by prefix (or everything)', async () => {
  const cache = createCache();
  let calls = 0;
  const load = async () => ++calls;
  await cache.get('album:1', 1000, load);
  await cache.get('artist:1', 1000, load);
  cache.invalidate('album:');
  await cache.get('album:1', 1000, load);
  await cache.get('artist:1', 1000, load);
  assert.equal(calls, 3);
  cache.invalidate();
  await cache.get('artist:1', 1000, load);
  assert.equal(calls, 4);
});
