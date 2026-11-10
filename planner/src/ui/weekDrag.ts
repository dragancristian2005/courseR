import { addDays, daysBetween, timeToMinutes } from '../domain/dates';
import type { HHMM, ISODate, Session } from '../domain/types';
import { STANDARD_SLOTS } from './format';

/** Week grid geometry: one row per standard slot, each slot SLOT_LENGTH minutes long. */
export const SLOT_MINUTES = STANDARD_SLOTS.map(timeToMinutes);
export const SLOT_LENGTH = 100;
export const ROW_HEIGHT = 64;

const LAST_MINUTE = 24 * 60 - 1;

/** The row a time falls in: the last standard slot starting at or before it (row 0 before 08:00). */
export function slotRowOf(t: HHMM): number {
  const m = timeToMinutes(t);
  let row = 0;
  SLOT_MINUTES.forEach((s, i) => {
    if (s <= m) row = i;
  });
  return row;
}

export function minutesToTime(m: number): HHMM {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface DropTarget {
  date: ISODate;
  start: HHMM;
  end: HHMM;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Where a class dragged by (dx, dy) pixels lands: the nearest day column (within the dayCount
 * shown from monday) and the nearest standard slot, keeping the class's length. Null when it
 * lands on the day and slot it started in.
 */
export function snapDrop({
  session,
  monday,
  dayCount,
  columnWidth,
  dx,
  dy,
}: {
  session: Pick<Session, 'date' | 'start' | 'end'>;
  monday: ISODate;
  dayCount: number;
  columnWidth: number;
  dx: number;
  dy: number;
}): DropTarget | null {
  const fromCol = daysBetween(monday, session.date);
  const fromRow = slotRowOf(session.start);
  const length = timeToMinutes(session.end) - timeToMinutes(session.start);
  const cols = columnWidth > 0 ? Math.round(dx / columnWidth) : 0;
  const col = clamp(fromCol + cols, 0, dayCount - 1);
  let row = clamp(fromRow + Math.round(dy / ROW_HEIGHT), 0, SLOT_MINUTES.length - 1);
  while (row > 0 && SLOT_MINUTES[row] + length > LAST_MINUTE) row--;
  if (col === fromCol && row === fromRow) return null;
  const start = SLOT_MINUTES[row];
  return {
    date: addDays(monday, col),
    start: minutesToTime(start),
    end: minutesToTime(start + length),
  };
}
