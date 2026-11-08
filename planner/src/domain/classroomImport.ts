import { compareDates } from './dates';
import { stamp } from './edits';
import { fold } from './importPlan';
import type { ClassroomCourse, HHMM, Homework, ISODate, PlannerData, Subject } from './types';

/** Structural shape of what the Classroom reader returns (`ClassroomFetch` is assignable to it). */
export interface ClassroomFetched {
  courses: { id: string; name: string; section: string | null }[];
  work: {
    id: string;
    courseId: string;
    title: string;
    dueDate: { year: number; month: number; day: number } | null;
    dueTime: { hours?: number; minutes?: number } | null;
  }[];
  turnedIn: Set<string>;
}

type DueDate = ClassroomFetched['work'][number]['dueDate'];
type DueTime = ClassroomFetched['work'][number]['dueTime'];

export interface ClassroomItem {
  workId: string;
  courseId: string;
  subjectId: string;
  title: string;
  due: ISODate | null;
  dueTime: HHMM | null;
  done: boolean;
  action: 'new' | 'update' | 'unchanged' | 'conflict';
  existing?: Homework;
}

export interface ClassroomPlan {
  /**
   * Courses that need a subject. importable: linking it would bring in at least one assignment
   * (or touch homework already imported from it).
   */
  unlinkedCourses: { id: string; name: string; suggestion: string | null; importable: boolean }[];
  items: ClassroomItem[];
}

export interface ClassroomAnswers {
  conflicts: Record<string, 'mine' | 'classroom'>;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Classroom gives UTC; the student lives in Europe/Bucharest. */
export function toLocalDue(
  dueDate: DueDate,
  dueTime: DueTime,
): { due: ISODate | null; dueTime: HHMM | null } {
  if (dueDate === null) return { due: null, dueTime: null };
  if (dueTime === null) {
    return {
      due: `${pad(dueDate.year, 4)}-${pad(dueDate.month)}-${pad(dueDate.day)}`,
      dueTime: null,
    };
  }
  const utc = Date.UTC(
    dueDate.year,
    dueDate.month - 1,
    dueDate.day,
    dueTime.hours ?? 0,
    dueTime.minutes ?? 0,
  );
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utc))) p[part.type] = part.value;
  return { due: `${p.year}-${p.month}-${p.day}`, dueTime: `${p.hour}:${p.minute}` };
}

function initials(name: string): string {
  return fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('');
}

/** The one attending subject a Classroom course name plainly refers to, or null. */
export function suggestSubject(courseName: string, subjects: Subject[]): string | null {
  const full = fold(courseName);
  const init = initials(courseName);
  const matches = subjects.filter((s) => {
    if (s.deleted || !s.attending) return false;
    const abbr = fold(s.abbreviation);
    return fold(s.name) === full || (abbr !== '' && (abbr === full || abbr === init));
  });
  return matches.length === 1 ? matches[0].id : null;
}

type Fields = { title: string; due: ISODate | null; dueTime: HHMM | null };

const sameFields = (a: Fields, b: Fields): boolean =>
  a.title === b.title && a.due === b.due && a.dueTime === b.dueTime;

function compareDue(a: ISODate | null, b: ISODate | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareDates(a, b);
}

/**
 * Whether an assignment not imported yet is brought in: overdue work the student turned in is
 * skipped, and so is work due before the semester's first day (no semester, no cutoff).
 */
function takesNew(
  due: ISODate | null,
  turnedIn: boolean,
  today: ISODate,
  cutoff: ISODate | null,
): boolean {
  if (due === null) return true;
  if (cutoff !== null && compareDates(due, cutoff) < 0) return false;
  return !(compareDates(due, today) < 0 && turnedIn);
}

export function planClassroomImport(
  fetched: ClassroomFetched,
  data: PlannerData,
  today: ISODate,
): ClassroomPlan {
  const subjects = new Map<string, Subject>();
  for (const s of data.subjects) if (!s.deleted) subjects.set(s.id, s);

  // A link to a subject that no longer exists counts as no link, so the course is asked again.
  const links = new Map<string, ClassroomCourse>();
  for (const c of data.classroomCourses) {
    if (c.deleted) continue;
    if (c.subjectId !== null && !subjects.has(c.subjectId)) continue;
    links.set(c.id, c);
  }

  const live = new Map<string, Homework>();
  const dead = new Set<string>();
  for (const h of data.homework) {
    if (h.source !== 'classroom' || h.externalId === undefined) continue;
    if (h.deleted) dead.add(h.externalId);
    else live.set(h.externalId, h);
  }

  const cutoff = data.semester && !data.semester.deleted ? data.semester.firstDay : null;
  const local = (w: ClassroomFetched['work'][number]) => toLocalDue(w.dueDate, w.dueTime);
  const counts = (w: ClassroomFetched['work'][number]): boolean => {
    if (live.has(w.id)) return true;
    if (dead.has(w.id)) return false;
    return takesNew(local(w).due, fetched.turnedIn.has(w.id), today, cutoff);
  };

  const unlinkedCourses = fetched.courses
    .filter((c) => !links.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      suggestion: suggestSubject(c.name, data.subjects),
      importable: fetched.work.some((w) => w.courseId === c.id && counts(w)),
    }));

  const items: ClassroomItem[] = [];
  for (const w of fetched.work) {
    const subjectId = links.get(w.courseId)?.subjectId ?? null;
    if (subjectId === null) continue;
    // Switched-off subjects are hidden everywhere, so their course imports nothing.
    if (!subjects.get(subjectId)?.attending) continue;
    if (!fetched.courses.some((c) => c.id === w.courseId)) continue;
    const existing = live.get(w.id);
    if (existing === undefined && dead.has(w.id)) continue;

    const { due, dueTime } = local(w);
    const turnedIn = fetched.turnedIn.has(w.id);
    const base = { workId: w.id, courseId: w.courseId, subjectId, title: w.title, due, dueTime };

    if (existing === undefined) {
      if (!takesNew(due, turnedIn, today, cutoff)) continue;
      items.push({ ...base, done: turnedIn, action: 'new' });
      continue;
    }

    const done = existing.done || turnedIn;
    const next: Fields = { title: w.title, due, dueTime };
    const imported: Fields = existing.imported ?? existing;
    let action: ClassroomItem['action'];
    if (sameFields(existing, next)) {
      // The student's fields already match Classroom; a stale snapshot is refreshed, or a later
      // Classroom change would look like a conflict.
      action = done === existing.done && sameFields(existing, imported) ? 'unchanged' : 'update';
    } else {
      const studentEdited = !sameFields(existing, imported);
      const classroomChanged = !sameFields(next, imported);
      if (studentEdited && classroomChanged) action = 'conflict';
      else if (classroomChanged) action = 'update';
      else action = done === existing.done ? 'unchanged' : 'update';
    }
    items.push({ ...base, done, action, existing });
  }

  const subjectOrder = new Map<string, string>();
  for (const s of data.subjects) subjectOrder.set(s.id, fold(s.name));
  const subjectKey = (id: string): string => subjectOrder.get(id) ?? id;
  items.sort(
    (a, b) =>
      subjectKey(a.subjectId).localeCompare(subjectKey(b.subjectId)) ||
      a.subjectId.localeCompare(b.subjectId) ||
      compareDue(a.due, b.due) ||
      a.title.localeCompare(b.title),
  );

  return { unlinkedCourses, items };
}

/** Nothing is saved here: the caller stores the returned records. Unchanged items yield nothing. */
export function applyClassroomImport(
  plan: ClassroomPlan,
  answers: ClassroomAnswers,
  links: ClassroomCourse[],
  data: PlannerData,
  now: number,
  newId: () => string,
): { courses: ClassroomCourse[]; homework: Homework[] } {
  void data;
  const homework: Homework[] = [];
  for (const item of plan.items) {
    const snapshot = { title: item.title, due: item.due, dueTime: item.dueTime };
    const ex = item.existing;
    if (item.action === 'new' || ex === undefined) {
      if (item.action !== 'new') continue;
      homework.push({
        id: newId(),
        title: item.title,
        subjectId: item.subjectId,
        due: item.due,
        dueTime: item.dueTime,
        done: item.done,
        source: 'classroom',
        externalId: item.workId,
        imported: snapshot,
        updatedAt: now,
      });
    } else if (item.action === 'update') {
      const imported: Fields = ex.imported ?? ex;
      const studentEdited = !sameFields(ex, imported);
      homework.push({
        ...ex,
        ...(studentEdited ? {} : snapshot),
        done: item.done,
        imported: snapshot,
        updatedAt: stamp(ex),
      });
    } else if (item.action === 'conflict') {
      const takeClassroom = answers.conflicts[item.workId] === 'classroom';
      homework.push({
        ...ex,
        ...(takeClassroom ? snapshot : {}),
        done: item.done,
        imported: snapshot,
        updatedAt: stamp(ex),
      });
    }
  }
  return { courses: links.map((c) => ({ ...c })), homework };
}
