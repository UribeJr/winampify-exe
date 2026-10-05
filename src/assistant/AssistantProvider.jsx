import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  initialBrain, persisted, decide, decideTip, flushQueue, registerClick, funFact, setHidden, finishTour
} from './brain';
import { formatClock } from './noteSense';
import { tipById, TOUR } from './tips';

const STORAGE_KEY = 'winampify-assistant';
const REMINDERS_KEY = 'winampify-reminders';
const SNOOZE_MS = 10 * 60 * 1000;
const MAX_TIMER_MS = 60 * 60 * 1000; // re-check at least hourly (long timeouts drift)
const LATE_MS = 5 * 60 * 1000;
const IDLE_MS = 3 * 60 * 1000;
const TALK_MS = 1400; // mouth flaps this long before settling into the tip's mood

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};

const loadReminders = () => {
  try {
    const list = JSON.parse(localStorage.getItem(REMINDERS_KEY));
    return Array.isArray(list) ? list.filter((r) => r && typeof r.label === 'string' && Number.isFinite(r.at)) : [];
  } catch {
    return [];
  }
};

// What Disky says when a reminder is due
const reminderTip = (r, now) => ({
  id: `reminder:${r.id}:${r.at}`,
  kind: 'reminder',
  once: false,
  mood: 'surprised',
  text: now - r.at > LATE_MS
    ? `While you were away: ${r.label} at ${formatClock(new Date(r.at))}. Hope it went well!`
    : `⏰ It's ${formatClock(new Date(r.at))} — ${r.label}!`,
  actions: [{ label: 'Snooze 10 min', action: 'snooze', payload: r }, { label: 'Got it', action: 'close' }]
});

const NOOP = {
  hidden: true, mood: 'idle', bubble: null, docked: false,
  notify: () => {}, notifyTip: () => {}, setBlocked: () => {}, registerHandler: () => () => {}, reminders: [], click: () => {}, openMenu: () => {}, close: () => {},
  showTip: () => {}, startTour: () => {}, nextTourStep: () => {}, hide: () => {}, show: () => {}, act: () => {}
};

const AssistantContext = createContext(NOOP);
export const useAssistant = () => useContext(AssistantContext);

/**
 * Disky's state: what he's saying (bubble), how he looks (mood), the tour, idle naps,
 * and what's remembered between visits (hidden, tips already seen, tour done).
 */
export function AssistantProvider({ children }) {
  const [brain, setBrain] = useState(() => initialBrain(load()));
  const [bubble, setBubble] = useState(null); // { kind: 'tip'|'menu'|'tour', text, actions?, step? }
  const [mood, setMood] = useState('idle');
  const brainRef = useRef(brain);
  const blockedRef = useRef(false);
  const moodTimerRef = useRef(null);
  const lastFactRef = useRef(null);
  const handlersRef = useRef({}); // actions handled by the app, e.g. 'recycle-note'
  const [reminders, setReminders] = useState(loadReminders);
  brainRef.current = brain;

  useEffect(() => {
    try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)); } catch { /* storage blocked */ }
  }, [reminders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted(brain))); } catch { /* storage blocked */ }
  }, [brain]);

  // Say something: talk for a moment, then settle into the line's mood
  const say = useCallback((next, settleMood = 'idle') => {
    clearTimeout(moodTimerRef.current);
    setBubble(next);
    setMood('talk');
    moodTimerRef.current = setTimeout(() => setMood(settleMood), TALK_MS);
  }, []);

  const present = useCallback((tip) => {
    say({ kind: tip.kind || 'tip', id: tip.id, text: tip.text, actions: tip.actions }, tip.mood);
  }, [say]);

  // Decided in a microtask: a child (e.g. a dialog) can notify from its effect before the
  // parent's effect has marked Disky as blocked by that same dialog
  const notify = useCallback((event, { prompted = false } = {}) => {
    queueMicrotask(() => {
      const { brain: next, tip } = decide(brainRef.current, event, Date.now(), { blocked: blockedRef.current, prompted });
      brainRef.current = next;
      setBrain(next);
      if (tip) present(tip);
    });
  }, [present]);

  // Same, for a tip built on the fly (note reactions, reminders)
  const notifyTip = useCallback((tip, { prompted = false, force = false } = {}) => {
    queueMicrotask(() => {
      const { brain: next, tip: shown } = decideTip(brainRef.current, tip, Date.now(), { blocked: blockedRef.current, prompted, force });
      brainRef.current = next;
      setBrain(next);
      if (shown) present(shown);
    });
  }, [present]);

  // Reminders: fire when due (also right after a reload if one came due while the page was closed)
  useEffect(() => {
    if (!reminders.length) return undefined;
    const now = Date.now();
    const due = reminders.filter((r) => r.at <= now);
    if (due.length) {
      setReminders((list) => list.filter((r) => r.at > now));
      due.forEach((r) => notifyTip(reminderTip(r, now), { prompted: true, force: true }));
      return undefined;
    }
    const next = Math.min(...reminders.map((r) => r.at));
    const timer = setTimeout(() => setReminders((list) => [...list]), Math.min(next - now, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [reminders, notifyTip]);

  const addReminder = useCallback((r) => {
    setReminders((list) => [...list.filter((x) => !(x.noteId === r.noteId && x.at === r.at)), { ...r, id: r.id || `${Date.now()}` }]);
  }, []);

  const registerHandler = useCallback((name, fn) => {
    handlersRef.current[name] = fn;
    return () => { if (handlersRef.current[name] === fn) delete handlersRef.current[name]; };
  }, []);

  // While a dialog is open Disky waits; when it closes he delivers the newest queued tip
  const setBlocked = useCallback((blocked) => {
    const wasBlocked = blockedRef.current;
    blockedRef.current = blocked;
    if (wasBlocked && !blocked && brainRef.current.queue.length) {
      const { brain: next, tip } = flushQueue(brainRef.current, Date.now());
      brainRef.current = next;
      setBrain(next);
      if (tip) present(tip);
    }
  }, [present]);

  const close = useCallback(() => {
    clearTimeout(moodTimerRef.current);
    setBubble(null);
    setMood('idle');
  }, []);

  const showFact = useCallback(() => {
    const fact = funFact(lastFactRef.current);
    lastFactRef.current = fact;
    say({ kind: 'tip', id: 'fact', text: fact, actions: [{ label: 'Another!', action: 'fact' }, { label: 'Thanks', action: 'close' }] }, 'happy');
  }, [say]);

  const openMenu = useCallback(() => {
    say({
      kind: 'menu',
      text: 'What can I do for you?',
      actions: [
        { label: 'Give me a tip', action: 'fact' },
        { label: 'Take the tour', action: 'tour' },
        { label: 'Hide Disky', action: 'hide' }
      ]
    }, 'happy');
  }, [say]);

  const startTour = useCallback(() => {
    const step = TOUR[0];
    say({ kind: 'tour', step: 0, text: step.text }, step.mood);
  }, [say]);

  const nextTourStep = useCallback(() => {
    setBubble((current) => {
      if (!current || current.kind !== 'tour') return current;
      const step = current.step + 1;
      if (step >= TOUR.length) {
        setBrain((b) => finishTour(b));
        setMood('happy');
        return null;
      }
      setMood(TOUR[step].mood);
      return { kind: 'tour', step, text: TOUR[step].text };
    });
  }, []);

  const hide = useCallback(() => {
    clearTimeout(moodTimerRef.current);
    setBubble(null);
    setBrain((b) => setHidden(b, true));
  }, []);

  const show = useCallback(() => {
    setBrain((b) => setHidden(b, false));
    say({ kind: 'tip', id: 'back', text: "I'm back! Did you miss me? (Don't answer that.)" }, 'wave');
  }, [say]);

  // Bubble buttons
  const act = useCallback((action, payload) => {
    if (action === 'tour') startTour();
    else if (action === 'fact') showFact();
    else if (action === 'hide') hide();
    else if (action === 'next') nextTourStep();
    else if (action === 'remind') {
      addReminder(payload);
      say({ kind: 'tip', id: 'reminder-set', text: `Okay! I'll remind you at ${formatClock(new Date(payload.at))}${payload.dayText ? ` ${payload.dayText}` : ''}. Keep Winampify open and I'll pop up.` }, 'happy');
    } else if (action === 'snooze') {
      addReminder({ ...payload, id: `${payload.id}-snooze`, at: Date.now() + SNOOZE_MS });
      say({ kind: 'tip', id: 'snoozed', text: 'Snoozed! Ten more minutes. I\'ll be right here.' }, 'sleepy');
    } else if (handlersRef.current[action]) {
      handlersRef.current[action](payload);
      close();
    } else close();
  }, [startTour, showFact, hide, nextTourStep, close, addReminder, say]);

  // Clicking Disky: wake him up, make him dizzy (5 quick clicks), or toggle his menu
  const click = useCallback(() => {
    const { brain: next, dizzy } = registerClick(brainRef.current, Date.now());
    brainRef.current = next;
    setBrain(next);
    if (dizzy) {
      clearTimeout(moodTimerRef.current);
      setMood('dizzy');
      const tip = tipById('dizzy');
      setBubble({ kind: 'tip', id: tip.id, text: tip.text });
      moodTimerRef.current = setTimeout(() => setMood('confused'), 1800);
      return;
    }
    if (mood === 'sleepy') {
      showFact();
      return;
    }
    if (bubble && bubble.kind !== 'tour') close();
    else if (!bubble) openMenu();
  }, [bubble, close, mood, openMenu, showFact]);

  // Nap after a while without any input (only when he's not mid-sentence)
  useEffect(() => {
    if (brain.hidden) return undefined;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setBubble((current) => {
          if (!current) setMood('sleepy');
          return current;
        });
      }, IDLE_MS);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [brain.hidden]);

  // Tour: highlight the element being explained
  const tourTarget = bubble?.kind === 'tour' ? TOUR[bubble.step]?.target : null;
  useEffect(() => {
    if (!tourTarget) return undefined;
    const el = document.querySelector(tourTarget);
    el?.classList.add('disky-highlight');
    return () => el?.classList.remove('disky-highlight');
  }, [tourTarget]);

  useEffect(() => () => clearTimeout(moodTimerRef.current), []);

  const value = useMemo(() => ({
    hidden: brain.hidden,
    tourDone: brain.tourDone,
    mood,
    bubble,
    notify,
    notifyTip,
    registerHandler,
    reminders,
    setBlocked,
    click,
    openMenu,
    close,
    showTip: (id) => { const tip = tipById(id); if (tip) present(tip); },
    startTour,
    nextTourStep,
    hide,
    show,
    act
  }), [brain.hidden, brain.tourDone, mood, bubble, notify, notifyTip, registerHandler, reminders, setBlocked, click, openMenu, close, present, startTour, nextTourStep, hide, show, act]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
