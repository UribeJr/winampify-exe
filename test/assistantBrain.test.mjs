import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialBrain, decide, flushQueue, registerClick, funFact, setHidden, persisted,
  COOLDOWN_MS, SESSION_CAP, QUEUE_LIMIT
} from '../src/assistant/brain.js';
import { FUN_FACTS } from '../src/assistant/tips.js';

const T0 = 1_000_000;

test('a tip shows once, then never again', () => {
  let { brain, tip } = decide(initialBrain(), 'note-created', T0);
  assert.equal(tip.id, 'note-created');
  ({ brain, tip } = decide(brain, 'note-created', T0 + COOLDOWN_MS * 2));
  assert.equal(tip, null);
  assert.deepEqual(persisted(brain).seen, ['note-created']);
});

test('unprompted tips respect the cooldown', () => {
  let { brain } = decide(initialBrain(), 'note-created', T0);
  let { tip } = decide(brain, 'display-opened', T0 + 1000);
  assert.equal(tip, null);
  ({ tip } = decide(brain, 'display-opened', T0 + COOLDOWN_MS + 1));
  assert.equal(tip.id, 'display-opened');
});

test('prompted tips skip the cooldown and session cap', () => {
  const busy = { ...initialBrain(), lastShownAt: T0, sessionCount: SESSION_CAP };
  assert.equal(decide(busy, 'hello', T0 + 10).tip, null);
  assert.equal(decide(busy, 'hello', T0 + 10, { prompted: true }).tip.id, 'hello');
});

test('the session cap stops unprompted tips', () => {
  const capped = { ...initialBrain(), sessionCount: SESSION_CAP };
  assert.equal(decide(capped, 'note-created', T0).tip, null);
});

test('repeatable tips can show again', () => {
  let { brain, tip } = decide(initialBrain(), 'hello', T0, { prompted: true });
  assert.equal(tip.id, 'hello');
  ({ tip } = decide(brain, 'hello', T0 + 5, { prompted: true }));
  assert.equal(tip.id, 'hello');
});

test('tips wait while a dialog blocks them, keeping only the newest', () => {
  let brain = initialBrain();
  for (const event of ['note-created', 'display-opened', 'run-unknown']) {
    const result = decide(brain, event, T0, { blocked: true });
    assert.equal(result.tip, null);
    brain = result.brain;
  }
  assert.equal(brain.queue.length, QUEUE_LIMIT);
  const { tip, brain: after } = flushQueue(brain, T0 + 10);
  assert.equal(tip.id, 'run-unknown');
  assert.equal(after.queue.includes('run-unknown'), false);
});

test('the welcome wins over newer queued tips', () => {
  let brain = decide(initialBrain(), 'first-visit', T0, { blocked: true }).brain;
  brain = decide(brain, 'player-opened', T0 + 5, { blocked: true }).brain;
  const { tip, brain: after } = flushQueue(brain, T0 + 10);
  assert.equal(tip.id, 'welcome');
  assert.deepEqual(after.queue, ['player-opened']);
});

test('hidden Disky says nothing and drops the queue', () => {
  const queued = decide(initialBrain(), 'note-created', T0, { blocked: true }).brain;
  const hidden = setHidden(queued, true);
  assert.equal(hidden.queue.length, 0);
  assert.equal(decide(hidden, 'hello', T0, { prompted: true }).tip, null);
});

test('five quick clicks make Disky dizzy', () => {
  let brain = initialBrain();
  let dizzy = false;
  for (let i = 0; i < 4; i += 1) ({ brain, dizzy } = registerClick(brain, T0 + i * 200));
  assert.equal(dizzy, false);
  ({ brain, dizzy } = registerClick(brain, T0 + 900));
  assert.equal(dizzy, true);
  // slow clicks never add up
  let slow = initialBrain();
  let slowDizzy = false;
  for (let i = 0; i < 6; i += 1) ({ brain: slow, dizzy: slowDizzy } = registerClick(slow, T0 + i * 1500));
  assert.equal(slowDizzy, false);
});

test('fun facts avoid repeating the previous one', () => {
  const first = funFact(null, () => 0);
  assert.notEqual(funFact(first, () => 0), first);
  assert.ok(FUN_FACTS.includes(funFact(undefined)));
});

test('initialBrain ignores bad saved data', () => {
  const brain = initialBrain({ hidden: 'yes', seen: ['ok', 5, null] });
  assert.equal(brain.hidden, true);
  assert.deepEqual(brain.seen, ['ok']);
});
