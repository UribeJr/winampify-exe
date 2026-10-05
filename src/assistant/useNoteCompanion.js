import { useEffect, useRef } from 'react';
import { analyzeNote } from './noteSense';
import { noteTitle } from '../os/stickyNotes';

const SETTLE_MS = 2500; // react once you've stopped typing

const when = (r) => `${r.timeText}${r.dayText ? ` ${r.dayText}` : ''}`;

// The one reaction (if any) for a note: finishing a checklist > a reminder > a new checklist > shopping
function reactionFor(note, analysis, previous) {
  const { reminder, checklist, shopping } = analysis;
  const wasComplete = previous?.checklist && previous.checklist.done === previous.checklist.total;

  if (checklist && checklist.total >= 2 && checklist.done === checklist.total && !wasComplete) {
    return {
      tip: {
        id: `note:${note.id}:done:${checklist.total}`,
        mood: 'happy',
        text: `You checked off all ${checklist.total} items on "${noteTitle(note)}"! 🎉 Want me to toss it in the Recycle Bin?`,
        actions: [{ label: 'Recycle it', action: 'recycle-note', payload: note.id }, { label: 'Keep it', action: 'close' }]
      },
      prompted: true // a reaction to something you just did, so it skips the cooldown
    };
  }
  if (reminder) {
    return {
      tip: {
        id: `note:${note.id}:reminder:${reminder.at}`,
        mood: 'surprised',
        text: `Don't forget — ${reminder.label} at ${when(reminder)}! Want me to remind you?`,
        actions: [
          { label: 'Remind me', action: 'remind', payload: { noteId: note.id, label: reminder.label, at: reminder.at, dayText: reminder.dayText } },
          { label: 'No thanks', action: 'close' }
        ]
      },
      prompted: true
    };
  }
  if (checklist && checklist.total >= 2 && checklist.done < checklist.total) {
    return {
      tip: {
        id: `note:${note.id}:checklist`,
        mood: 'happy',
        text: 'A to-do list! Change [ ] to [x] as you finish things, and I\'ll cheer when you\'re done.'
      }
    };
  }
  if (shopping) {
    return {
      tip: {
        id: `note:${note.id}:shopping`,
        mood: 'happy',
        text: 'Grocery run? Don\'t forget the snacks. And maybe tortillas. Always tortillas.'
      }
    };
  }
  return null;
}

/**
 * Disky reads your sticky notes (locally) and reacts once you stop typing: offers reminders
 * for times like "dentist 3pm", cheers when a [ ] checklist is all [x], and quips about
 * shopping lists. Notes that already existed when the page loaded are left alone.
 */
export default function useNoteCompanion(notes, assistant) {
  const textsRef = useRef(null); // last seen text per note
  const analysisRef = useRef({}); // last analysis per note (to spot "just completed")
  const timersRef = useRef({});
  const { notifyTip } = assistant;

  useEffect(() => {
    // First run: remember what's there without reacting
    if (textsRef.current === null) {
      textsRef.current = Object.fromEntries(notes.map((n) => [n.id, n.text]));
      notes.forEach((n) => { analysisRef.current[n.id] = analyzeNote(n.text); });
      return;
    }
    notes.forEach((note) => {
      if (textsRef.current[note.id] === note.text) return;
      textsRef.current[note.id] = note.text;
      clearTimeout(timersRef.current[note.id]);
      timersRef.current[note.id] = setTimeout(() => {
        const analysis = analyzeNote(note.text);
        const reaction = reactionFor(note, analysis, analysisRef.current[note.id]);
        analysisRef.current[note.id] = analysis;
        if (reaction) notifyTip(reaction.tip, { prompted: Boolean(reaction.prompted) });
      }, SETTLE_MS);
    });
    // Forget deleted notes
    const ids = new Set(notes.map((n) => n.id));
    Object.keys(textsRef.current).forEach((id) => {
      if (!ids.has(id)) {
        clearTimeout(timersRef.current[id]);
        delete textsRef.current[id];
        delete analysisRef.current[id];
      }
    });
  }, [notes, notifyTip]);

  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), []);
}
