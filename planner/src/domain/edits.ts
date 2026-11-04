import { addDays, compareDates } from './dates';
import type {
  ClassPattern,
  HHMM,
  ISODate,
  Note,
  PlannerData,
  Session,
  SessionOverride,
} from './types';

/**
 * validFrom for a newly created class: open-ended on the left, so the class also appears in
 * weeks added later by moving the semester's first day earlier. generate() clips to the semester.
 */
export const OPEN_START: ISODate = '0000-01-01';

/**
 * Timestamp for an edit: now, but always strictly newer than the record being replaced, so
 * last-write-wins accepts the edit even when the clock is behind or two edits share a millisecond.
 */
export function stamp(prev?: { updatedAt: number }): number {
  return Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1);
}

function overrideId(session: Session): string {
  return `ov_${session.id.replace(':', '_')}`;
}

export function moveThisWeek(
  session: Session,
  to: { date: ISODate; start: HHMM; end: HHMM; room?: string },
  now: number,
): SessionOverride {
  const o: SessionOverride = {
    id: overrideId(session),
    sessionId: session.id,
    kind: 'moved',
    date: to.date,
    start: to.start,
    end: to.end,
    updatedAt: now,
  };
  if (to.room !== undefined) o.room = to.room;
  return o;
}

export function cancelThisWeek(session: Session, now: number): SessionOverride {
  return { id: overrideId(session), sessionId: session.id, kind: 'cancelled', updatedAt: now };
}

type PatternChanges = Partial<
  Pick<
    ClassPattern,
    'type' | 'weekday' | 'start' | 'end' | 'room' | 'teacher' | 'repeat' | 'online'
  >
>;

export function changeEveryWeek(
  pattern: ClassPattern,
  from: ISODate,
  changes: PatternChanges,
  now: number,
  newId: () => string,
): { ended: ClassPattern; created: ClassPattern } {
  if (pattern.validTo !== null && compareDates(from, pattern.validTo) > 0) {
    throw new Error('Cannot change a class after it has ended.');
  }
  const effectiveFrom = compareDates(from, pattern.validFrom) < 0 ? pattern.validFrom : from;

  const ended: ClassPattern = { ...pattern, updatedAt: now };
  if (effectiveFrom === pattern.validFrom) {
    ended.deleted = true;
  } else {
    ended.validTo = addDays(effectiveFrom, -1);
  }

  const created: ClassPattern = { ...pattern };
  delete created.deleted;
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) (created as unknown as Record<string, unknown>)[k] = v;
  }
  created.id = newId();
  created.validFrom = effectiveFrom;
  created.validTo = pattern.validTo;
  created.updatedAt = now;
  return { ended, created };
}

function belongsOnOrAfter(sessionId: string | null, patternId: string, from: ISODate): boolean {
  if (sessionId === null) return false;
  const i = sessionId.lastIndexOf(':');
  if (i <= 0) return false;
  return sessionId.slice(0, i) === patternId && compareDates(sessionId.slice(i + 1), from) >= 0;
}

/** Live one-off changes and notes that a change from `from` would no longer attach to. */
export function droppedByChange(
  data: PlannerData,
  patternId: string,
  from: ISODate,
): { overrides: SessionOverride[]; notes: Note[] } {
  return {
    overrides: data.overrides.filter(
      (o) => !o.deleted && belongsOnOrAfter(o.sessionId, patternId, from),
    ),
    notes: data.notes.filter((n) => !n.deleted && belongsOnOrAfter(n.sessionId, patternId, from)),
  };
}
