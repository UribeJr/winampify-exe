// Reads a sticky note (locally, nothing leaves the browser) for things Disky can react to:
// a reminder ("dentist 3pm", "call mom tomorrow 9:30am", "standup fri 10:00"),
// a checklist ("[ ] milk" / "[x] eggs"), or a shopping list.

const TIME_12H = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?\s*m\.?(?=[^a-z]|$)/i;
const TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const NOON_MIDNIGHT = /\b(noon|midnight)\b/i;
const TOMORROW = /\btomorrow\b/i;
const TODAY = /\b(today|tonight|this (?:morning|afternoon|evening))\b/i;
const WEEKDAYS = [
  [/\bsun(?:day)?\b/i, 0],
  [/\bmon(?:day)?\b/i, 1],
  [/\btue(?:s|sday)?\b/i, 2],
  [/\bwed(?:nesday)?\b/i, 3],
  [/\bthu(?:r|rs|rsday)?\b/i, 4],
  [/\bfri(?:day)?\b/i, 5],
  [/\bsat(?:urday)?\b/i, 6]
];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CHECK_ITEM = /^\s*(?:[-*•]\s*)?\[( |x|X|✓)\]/;
const SHOPPING = /\b(grocer(?:y|ies)|shopping|supermarket|buy|pick up|milk|eggs|bread|tortillas)\b/i;

export const formatClock = (date) => {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

// Hours/minutes from a line, or null
function readTime(line) {
  const twelve = line.match(TIME_12H);
  if (twelve) {
    let hours = Number(twelve[1]) % 12;
    if (twelve[3].toLowerCase() === 'p') hours += 12;
    return { hours, minutes: Number(twelve[2] || 0), match: twelve[0] };
  }
  const word = line.match(NOON_MIDNIGHT);
  if (word) return { hours: word[1].toLowerCase() === 'noon' ? 12 : 0, minutes: 0, match: word[0] };
  const twentyFour = line.match(TIME_24H);
  if (twentyFour) return { hours: Number(twentyFour[1]), minutes: Number(twentyFour[2]), match: twentyFour[0] };
  return null;
}

// Which day the reminder is for: { offsetDays, label } or null for "today, if still ahead"
function readDay(text, now) {
  if (TOMORROW.test(text)) return { offsetDays: 1, label: 'tomorrow', match: text.match(TOMORROW)[0] };
  if (TODAY.test(text)) return { offsetDays: 0, label: '', match: text.match(TODAY)[0], explicit: true };
  for (const [pattern, day] of WEEKDAYS) {
    const m = text.match(pattern);
    if (m) {
      const offsetDays = (day - now.getDay() + 7) % 7;
      return { offsetDays, label: offsetDays === 0 ? '' : `on ${WEEKDAY_NAMES[day]}`, match: m[0], weekday: true };
    }
  }
  return null;
}

const cleanLabel = (line, ...parts) => {
  let label = line.replace(CHECK_ITEM, '');
  parts.filter(Boolean).forEach((p) => { label = label.replace(p, ' '); });
  return label
    .replace(/\b(at|on|by|@)\s*$/i, '')
    .replace(/^\s*[-*•:]+/, '')
    .replace(/[\s,;:.!-]+$/g, '')
    .replace(/\b(at|@)\s+(?=\s|$)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Returns { reminder, checklist, shopping }:
 *   reminder:  { label, at (ms), timeText, dayText } | null — only for a time still ahead
 *   checklist: { total, done } | null
 *   shopping:  boolean
 */
export function analyzeNote(text, now = new Date()) {
  const lines = String(text || '').split('\n');
  const items = lines.filter((l) => CHECK_ITEM.test(l));
  const checklist = items.length
    ? { total: items.length, done: items.filter((l) => /\[(x|X|✓)\]/.test(l)).length }
    : null;

  let reminder = null;
  for (const line of lines) {
    const time = readTime(line);
    if (!time) continue;
    if (CHECK_ITEM.test(line) && /\[(x|X|✓)\]/.test(line)) continue; // already done
    const day = readDay(line, now) || readDay(text, now);
    const at = new Date(now);
    at.setHours(time.hours, time.minutes, 0, 0);
    at.setDate(at.getDate() + (day?.offsetDays || 0));
    // Same weekday but the time has passed → next week
    if (day?.weekday && day.offsetDays === 0 && at <= now) {
      at.setDate(at.getDate() + 7);
    }
    if (at <= now) continue; // a time that's already gone today isn't a reminder
    const firstLine = lines.find((l) => l.trim()) || '';
    const label = cleanLabel(line, time.match, day && line.includes(day.match) ? day.match : null)
      || cleanLabel(firstLine, time.match) || 'your reminder';
    const dayText = day?.weekday && day.offsetDays === 0 && at.getDate() !== now.getDate()
      ? `next ${WEEKDAY_NAMES[at.getDay()]}`
      : day?.label || '';
    reminder = { label, at: at.getTime(), timeText: formatClock(at), dayText };
    break;
  }

  return { reminder, checklist, shopping: SHOPPING.test(text || '') };
}
