import { addDays, compareDates } from './dates';
import type { ClassPattern, HHMM, ISODate, Session, SessionOverride } from './types';

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
  Pick<ClassPattern, 'type' | 'weekday' | 'start' | 'end' | 'room' | 'teacher' | 'repeat' | 'online'>
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
