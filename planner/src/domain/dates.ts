import type { HHMM, ISODate } from './types';

const DAY_MS = 86_400_000;

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** Monday = 1 ... Sunday = 7 */
export function weekdayOf(d: ISODate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const js = new Date(toUTC(d)).getUTCDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function mondayOf(d: ISODate): ISODate {
  return addDays(d, 1 - weekdayOf(d));
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** Local calendar date of `now`. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function timeToMinutes(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isDate(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === day;
}

/** True for a time written exactly HH:MM (00:00 to 23:59). */
export function isTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
