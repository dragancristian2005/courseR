import { compareDates, timeToMinutes } from './dates';
import { buildCalendar, type IcsEvent } from './ics';
import { sessionsBetween } from './sessions';
import type { ClassType, HHMM, ISODate, PlannerData } from './types';

const TYPE_WORD: Record<ClassType, string> = { course: 'course', seminar: 'seminar', lab: 'lab' };

const EXAM_MINUTES = 120;
const LAST_MINUTE = 23 * 60 + 59;
/** Classes are generated only inside the semester, but a move can carry one past its last day. */
const NO_END: ISODate = '9999-12-31';

const pad = (n: number) => String(n).padStart(2, '0');
const minutesToTime = (m: number): HHMM => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** `today`: exams earlier than this are left out (default: `from`); classes always start at `from`. */
export type ExportOptions = { classes: boolean; exams: boolean; today?: ISODate };

/** Sort key: all-day events first within a date, then by start time. */
const startMinutes = (e: IcsEvent) => (e.kind === 'timed' ? timeToMinutes(e.start) : -1);

export function calendarEvents(data: PlannerData, from: ISODate, opts: ExportOptions): IcsEvent[] {
  const events: IcsEvent[] = [];

  if (opts.classes && data.semester) {
    const names = new Map(data.subjects.map((s) => [s.id, s.name]));
    const patternEdited = new Map(data.patterns.map((p) => [p.id, p.updatedAt]));
    const overrideEdited = new Map<string, number>();
    for (const o of data.overrides) {
      if (!o.deleted) {
        overrideEdited.set(
          o.sessionId,
          Math.max(overrideEdited.get(o.sessionId) ?? 0, o.updatedAt),
        );
      }
    }
    for (const s of sessionsBetween(data, from, NO_END)) {
      const lines: string[] = [];
      if (s.teacher) lines.push(`Teacher: ${s.teacher}`);
      if (s.moved) lines.push('Moved this week');
      const e: IcsEvent = {
        kind: 'timed',
        uid: `${s.id.replace(/:/g, '-')}@study-planner`,
        summary: `${names.get(s.subjectId) ?? ''} (${TYPE_WORD[s.type]})`,
        location: s.online ? 'Online' : s.room || undefined,
        date: s.date,
        start: s.start,
        end: s.end,
      };
      if (lines.length) e.description = lines.join('\n');
      const edited = Math.max(patternEdited.get(s.patternId) ?? 0, overrideEdited.get(s.id) ?? 0);
      if (edited > 0) e.lastModified = edited;
      if (e.location === undefined) delete e.location;
      events.push(e);
    }
  }

  if (opts.exams) {
    const examsFrom = opts.today ?? from;
    for (const x of data.exams) {
      if (x.deleted || compareDates(x.date, examsFrom) < 0) continue;
      const subject = x.subjectId
        ? data.subjects.find((s) => s.id === x.subjectId && !s.deleted)
        : undefined;
      const base = {
        uid: `exam-${x.id}@study-planner`,
        summary: subject ? `${subject.name}: ${x.title}` : x.title,
        ...(x.room ? { location: x.room } : {}),
        ...(x.updatedAt > 0 ? { lastModified: x.updatedAt } : {}),
        date: x.date,
      };
      events.push(
        x.start
          ? {
              ...base,
              kind: 'timed',
              start: x.start,
              end: minutesToTime(Math.min(timeToMinutes(x.start) + EXAM_MINUTES, LAST_MINUTE)),
            }
          : { ...base, kind: 'allDay' },
      );
    }
  }

  return events.sort((a, b) => compareDates(a.date, b.date) || startMinutes(a) - startMinutes(b));
}

export function exportCalendar(
  data: PlannerData,
  from: ISODate,
  opts: ExportOptions,
  now: Date,
): { ics: string; count: number } {
  const events = calendarEvents(data, from, opts);
  return { ics: buildCalendar(events, { name: 'Study Planner', now }), count: events.length };
}
