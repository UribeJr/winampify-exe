import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNote, formatClock } from '../src/assistant/noteSense.js';

// Thursday, 1 Oct 2026, 10:00 local time
const NOW = new Date(2026, 9, 1, 10, 0, 0);
const at = (r) => new Date(r.at);

test('finds a later-today reminder and labels it from the line', () => {
  const { reminder } = analyzeNote('Dentist 3pm', NOW);
  assert.equal(reminder.label, 'Dentist');
  assert.equal(reminder.timeText, '3:00 PM');
  assert.equal(reminder.dayText, '');
  assert.equal(at(reminder).getDate(), 1);
});

test('understands minutes, a.m./p.m. spellings, 24h clocks and noon', () => {
  assert.equal(analyzeNote('call mom at 4:45 p.m.', NOW).reminder.timeText, '4:45 PM');
  assert.equal(analyzeNote('standup 14:30', NOW).reminder.timeText, '2:30 PM');
  assert.equal(analyzeNote('lunch with Ana at noon', NOW).reminder.label, 'lunch with Ana');
});

test('tomorrow and weekdays move the date', () => {
  const tomorrow = analyzeNote('gym tomorrow 7am', NOW).reminder;
  assert.equal(at(tomorrow).getDate(), 2);
  assert.equal(tomorrow.dayText, 'tomorrow');
  assert.equal(tomorrow.label, 'gym');

  const friday = analyzeNote('pay rent fri 9:00', NOW).reminder;
  assert.equal(at(friday).getDay(), 5);
  assert.equal(friday.dayText, 'on Friday');

  const nextThu = analyzeNote('team sync thursday 9am', NOW).reminder; // 9am today already passed
  assert.equal(at(nextThu).getDate(), 8);
  assert.equal(nextThu.dayText, 'next Thursday');

  const laterToday = analyzeNote('team sync thursday 4pm', NOW).reminder; // still ahead today
  assert.equal(at(laterToday).getDate(), 1);
  assert.equal(laterToday.dayText, '');
});

test('times already past today are not reminders; done items are skipped', () => {
  assert.equal(analyzeNote('breakfast 8am', NOW).reminder, null);
  assert.equal(analyzeNote('[x] dentist 3pm', NOW).reminder, null);
  assert.equal(analyzeNote('no times here', NOW).reminder, null);
});

test('label falls back to the first line when the time line is bare', () => {
  assert.equal(analyzeNote('Haircut\n5pm', NOW).reminder.label, 'Haircut');
});

test('checklists count done items', () => {
  const { checklist } = analyzeNote('Groceries\n[ ] milk\n- [x] eggs\n[X] coffee', NOW);
  assert.deepEqual(checklist, { total: 3, done: 2 });
  assert.equal(analyzeNote('just text', NOW).checklist, null);
});

test('spots shopping lists', () => {
  assert.equal(analyzeNote('Buy tortillas and salsa', NOW).shopping, true);
  assert.equal(analyzeNote('Finish the report', NOW).shopping, false);
});

test('formatClock uses a 12-hour clock', () => {
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 5)), '12:05 AM');
  assert.equal(formatClock(new Date(2026, 0, 1, 12, 0)), '12:00 PM');
});
