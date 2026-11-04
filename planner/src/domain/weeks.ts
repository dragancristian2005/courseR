import { addDays, compareDates, mondayOf } from './dates';
import type { ISODate, Parity, Semester } from './types';

export interface Week {
  monday: ISODate;
  number: number | null;
  parity: Parity | null;
  isBreak: boolean;
}

export function buildWeeks(s: Semester): Week[] {
  const weeks: Week[] = [];
  let teaching = 0;
  for (
    let monday = mondayOf(s.firstDay);
    compareDates(monday, s.lastDay) <= 0;
    monday = addDays(monday, 7)
  ) {
    const isBreak = s.breaks.some(
      (b) => compareDates(monday, b.from) >= 0 && compareDates(monday, b.to) <= 0,
    );
    if (isBreak) {
      weeks.push({ monday, number: null, parity: null, isBreak: true });
      continue;
    }
    teaching += 1;
    const parity: Parity = s.parityOverrides[teaching] ?? (teaching % 2 === 1 ? 'odd' : 'even');
    weeks.push({ monday, number: teaching, parity, isBreak: false });
  }
  return weeks;
}

export function weekFor(s: Semester, d: ISODate): Week | null {
  const monday = mondayOf(d);
  return buildWeeks(s).find((w) => w.monday === monday) ?? null;
}
