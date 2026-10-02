// Disky's decision-making, kept pure (no React, no timers) so it's easy to test.
// Unprompted tips (from app events) are rate-limited; anything the user asks for is not.

import { FUN_FACTS, tipForEvent } from './tips.js';

export const COOLDOWN_MS = 60 * 1000;
export const SESSION_CAP = 5;
export const QUEUE_LIMIT = 2;
export const DIZZY_CLICKS = 5;
export const DIZZY_WINDOW_MS = 2000;

export const initialBrain = (saved = {}) => ({
  hidden: Boolean(saved.hidden),
  seen: Array.isArray(saved.seen) ? saved.seen.filter((id) => typeof id === 'string') : [],
  tourDone: Boolean(saved.tourDone),
  lastShownAt: 0,
  sessionCount: 0,
  queue: [],
  clicks: []
});

// What gets saved between visits
export const persisted = (brain) => ({ hidden: brain.hidden, seen: brain.seen, tourDone: brain.tourDone });

const markShown = (brain, tip, now, counted) => ({
  ...brain,
  seen: tip.once === false || brain.seen.includes(tip.id) ? brain.seen : [...brain.seen, tip.id],
  lastShownAt: now,
  sessionCount: counted ? brain.sessionCount + 1 : brain.sessionCount,
  queue: brain.queue.filter((id) => id !== tip.id)
});

/**
 * React to an app event. Returns { brain, tip } where tip is null when Disky stays quiet.
 * - once-only tips never repeat
 * - unprompted tips respect a cooldown and a per-session cap
 * - while `blocked` (a dialog is open) tips wait in a small queue
 * - `prompted` (the user asked) skips the rate limits but still respects `hidden`
 */
export function decide(brain, event, now, { blocked = false, prompted = false } = {}) {
  const tip = tipForEvent(event);
  if (!tip || brain.hidden) return { brain, tip: null };
  if (tip.once !== false && brain.seen.includes(tip.id)) return { brain, tip: null };
  if (blocked) {
    const queue = [...brain.queue.filter((id) => id !== event), event].slice(-QUEUE_LIMIT);
    return { brain: { ...brain, queue }, tip: null };
  }
  if (!prompted) {
    if (now - brain.lastShownAt < COOLDOWN_MS && brain.lastShownAt !== 0) return { brain, tip: null };
    if (brain.sessionCount >= SESSION_CAP) return { brain, tip: null };
  }
  return { brain: markShown(brain, tip, now, !prompted), tip };
}

// Once nothing is blocking, deliver a queued tip (it was queued, so it skips the cooldown):
// priority tips first (the welcome), otherwise the newest
export function flushQueue(brain, now) {
  const order = [...brain.queue].reverse().sort((a, b) => Number(Boolean(tipForEvent(b)?.priority)) - Number(Boolean(tipForEvent(a)?.priority)));
  for (const event of order) {
    const tip = tipForEvent(event);
    const rest = { ...brain, queue: brain.queue.filter((e) => e !== event) };
    if (tip && !brain.hidden && !(tip.once !== false && brain.seen.includes(tip.id))) {
      return { brain: markShown(rest, tip, now, true), tip };
    }
    brain = rest;
  }
  return { brain, tip: null };
}

// A random fun fact, avoiding an immediate repeat of `previous`
export function funFact(previous, random = Math.random) {
  const pool = FUN_FACTS.filter((f) => f !== previous);
  return pool[Math.floor(random() * pool.length)];
}

// Rapid clicking on Disky: returns { brain, dizzy } — dizzy on the 5th click within 2 s
export function registerClick(brain, now) {
  const clicks = [...brain.clicks.filter((t) => now - t < DIZZY_WINDOW_MS), now];
  if (clicks.length >= DIZZY_CLICKS) return { brain: { ...brain, clicks: [] }, dizzy: true };
  return { brain: { ...brain, clicks }, dizzy: false };
}

export const setHidden = (brain, hidden) => ({ ...brain, hidden, queue: hidden ? [] : brain.queue });
export const finishTour = (brain) => ({ ...brain, tourDone: true });
