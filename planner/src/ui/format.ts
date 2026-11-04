import { MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../domain/calendarWords';
import { daysBetween, todayISO, weekdayOf } from '../domain/dates';
import type { ClassPattern, ClassType, ISODate, PlannerData, Subject } from '../domain/types';

export { MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT };

export const TYPE_LABEL: Record<ClassType, string> = {
  course: 'Course',
  seminar: 'Seminar',
  lab: 'Lab',
};

/** Start times of the standard teaching slots, shared by Today and the week grid. */
export const STANDARD_SLOTS = [
  '08:00',
  '09:40',
  '11:20',
  '13:00',
  '14:40',
  '16:20',
  '18:00',
  '19:40',
];

/** "Mon 2 Nov" */
export function shortDate(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${WEEKDAYS_SHORT[weekdayOf(d) - 1]} ${day} ${MONTHS_SHORT[m - 1]}`;
}

/** "Monday 2 November" */
export function longDate(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${WEEKDAYS_LONG[weekdayOf(d) - 1]} ${day} ${MONTHS_LONG[m - 1]}`;
}

/** "Today" / "1 day" / "n days", as on the Today screen. */
export function daysCount(n: number): string {
  return n === 0 ? 'Today' : n === 1 ? '1 day' : `${n} days`;
}

/** How long ago a note was written, by calendar days. */
export function ageLabel(createdAt: number, now: Date): string {
  const created = todayISO(new Date(createdAt));
  const n = daysBetween(created, todayISO(now));
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return 'Last week';
  const [, m, day] = created.split('-').map(Number);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

/** Lowercase, with accents stripped, so "rețelelor" matches "retelelor". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SessionRef {
  pattern: ClassPattern;
  subject: Subject | undefined;
  date: ISODate;
}

/** Resolves `${patternId}:${date}` to its pattern, subject and date, or null if the pattern is gone. */
export function sessionRef(data: PlannerData, sessionId: string | null): SessionRef | null {
  if (!sessionId) return null;
  const i = sessionId.lastIndexOf(':');
  if (i <= 0) return null;
  const pattern = data.patterns.find((p) => p.id === sessionId.slice(0, i) && !p.deleted);
  if (!pattern) return null;
  return {
    pattern,
    subject: data.subjects.find((s) => s.id === pattern.subjectId && !s.deleted),
    date: sessionId.slice(i + 1),
  };
}

/** "2 – 6 Nov" or "30 Nov – 4 Dec" (same month names the month once). */
export function dayRange(from: ISODate, to: ISODate): string {
  const [, m1, d1] = from.split('-').map(Number);
  const [, m2, d2] = to.split('-').map(Number);
  return m1 === m2
    ? `${d1} – ${d2} ${MONTHS_SHORT[m2 - 1]}`
    : `${d1} ${MONTHS_SHORT[m1 - 1]} – ${d2} ${MONTHS_SHORT[m2 - 1]}`;
}
