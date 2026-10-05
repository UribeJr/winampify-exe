import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN, PICKS, DEFAULT_VIZ_ID, libraryEntries, nextViz, prevViz, randomViz, restoreViz, groupViz, vizLabel
} from '../src/player/visualizations.js';

const list = [...BUILT_IN, ...libraryEntries(['Zeta preset', PICKS[0].presetKey, 'Alpha preset'])];

test('library entries skip the hand-picked presets and sort by name', () => {
  const lib = list.filter((v) => v.group === 'MilkDrop library');
  assert.deepEqual(lib.map((v) => v.name), ['Alpha preset', 'Zeta preset']);
  assert.ok(lib.every((v) => v.id.startsWith('lib:') && v.type === 'milkdrop'));
});

test('next/prev step through the whole list and wrap around', () => {
  assert.equal(nextViz(list, 'bars').id, 'scope');
  assert.equal(prevViz(list, 'bars').id, list[list.length - 1].id);
  assert.equal(nextViz(list, list[list.length - 1].id).id, list[0].id);
});

test('random never repeats the current visualization', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.notEqual(randomViz(list, 'scope').id, 'scope');
  }
  assert.equal(randomViz([BUILT_IN[0]], BUILT_IN[0].id).id, BUILT_IN[0].id);
});

test('restoring an unknown saved id falls back to the default', () => {
  assert.equal(restoreViz(list, 'lib:Zeta preset').name, 'Zeta preset');
  assert.equal(restoreViz(list, 'nope').id, DEFAULT_VIZ_ID);
  assert.equal(restoreViz(list, undefined).id, DEFAULT_VIZ_ID);
});

test('groups keep display order and labels read like WMP', () => {
  assert.deepEqual(groupViz(list).map((g) => g.name), ['Classics', 'Winampify', 'MilkDrop library']);
  assert.equal(vizLabel(list[0]), 'Classics : Bars and Waves');
});
