import { addDays, compareDates, daysBetween, mondayOf, timeToMinutes, weekdayOf } from './dates';
import { MONTHS_SHORT, WEEKDAYS_SHORT } from './calendarWords';
import { sessionsBetween } from './sessions';
import type {
  Exam,
  HHMM,
  Homework,
  ISODate,
  Link,
  Note,
  PlannerData,
  Session,
  Subject,
} from './types';
import { weekFor } from './weeks';
import type { Week } from './weeks';

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const alive = <T extends { deleted?: boolean }>(xs: T[]): T[] => xs.filter((x) => !x.deleted);

export function todayAgenda(
  data: PlannerData,
  today: ISODate,
  nowMinutes: number,
): {
  week: Week | null;
  sessions: Session[];
  currentSessionId: string | null;
  freeAfter: HHMM | null;
  setupNeeded: boolean;
} {
  const sem = data.semester && !data.semester.deleted ? data.semester : null;
  const setupNeeded = !sem || alive(data.patterns).length === 0;
  const week = sem ? weekFor(sem, today) : null;
  const sessions = week?.isBreak ? [] : sessionsBetween(data, today, today);
  const current = sessions.find(
    (s) => timeToMinutes(s.start) <= nowMinutes && nowMinutes < timeToMinutes(s.end),
  );
  const freeAfter = sessions.reduce<HHMM | null>(
    (acc, s) => (acc === null || timeToMinutes(s.end) > timeToMinutes(acc) ? s.end : acc),
    null,
  );
  return { week, sessions, currentSessionId: current?.id ?? null, freeAfter, setupNeeded };
}

export function nextExam(
  data: PlannerData,
  today: ISODate,
): { exam: Exam; daysAway: number } | null {
  const upcoming = alive(data.exams)
    .filter((e) => compareDates(e.date, today) >= 0)
    .sort(
      (a, b) =>
        compareDates(a.date, b.date) ||
        (a.start === null ? -1 : 0) - (b.start === null ? -1 : 0) ||
        (a.start !== null && b.start !== null ? cmpStr(a.start, b.start) : 0),
    );
  const exam = upcoming[0];
  return exam ? { exam, daysAway: daysBetween(today, exam.date) } : null;
}

function byDueThenTimeThenTitle(a: Homework, b: Homework): number {
  return (
    compareDates(a.due, b.due) ||
    (a.dueTime === null ? 1 : 0) - (b.dueTime === null ? 1 : 0) ||
    (a.dueTime !== null && b.dueTime !== null ? cmpStr(a.dueTime, b.dueTime) : 0) ||
    cmpStr(a.title, b.title)
  );
}

export function homeworkGroups(
  data: PlannerData,
  today: ISODate,
): { thisWeek: Homework[]; later: Homework[]; done: Homework[] } {
  const sunday = addDays(mondayOf(today), 6);
  const all = alive(data.homework);
  const open = all.filter((h) => !h.done).sort(byDueThenTimeThenTitle);
  return {
    thisWeek: open.filter((h) => compareDates(h.due, sunday) <= 0),
    later: open.filter((h) => compareDates(h.due, sunday) > 0),
    done: all.filter((h) => h.done).sort((a, b) => compareDates(b.due, a.due)),
  };
}

export function notesFor(
  data: PlannerData,
  filter: { subjectId?: string; sessionId?: string },
): Note[] {
  const patternSubject = new Map(alive(data.patterns).map((p) => [p.id, p.subjectId]));
  const subjectOfSession = (sessionId: string | null): string | null => {
    if (sessionId === null) return null;
    const i = sessionId.lastIndexOf(':');
    return i > 0 ? (patternSubject.get(sessionId.slice(0, i)) ?? null) : null;
  };
  return alive(data.notes)
    .filter((n) => {
      if (filter.sessionId !== undefined && n.sessionId !== filter.sessionId) return false;
      if (
        filter.subjectId !== undefined &&
        n.subjectId !== filter.subjectId &&
        subjectOfSession(n.sessionId) !== filter.subjectId
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

const byTitle = (a: Link, b: Link): number => cmpStr(a.title, b.title);

export function linksBySubject(data: PlannerData): {
  general: Link[];
  bySubject: { subject: Subject; links: Link[] }[];
} {
  const links = alive(data.links);
  return {
    general: links.filter((l) => l.subjectId === null).sort(byTitle),
    bySubject: alive(data.subjects)
      .filter((s) => s.attending)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((subject) => ({
        subject,
        links: links.filter((l) => l.subjectId === subject.id).sort(byTitle),
      })),
  };
}


export function dueLabel(due: ISODate, today: ISODate): string {
  const diff = daysBetween(today, due);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const [, m, d] = due.split('-').map(Number);
  if (diff <= 6) return `${WEEKDAYS_SHORT[weekdayOf(due) - 1]} ${d}`;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}
