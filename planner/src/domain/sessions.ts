import { addDays, compareDates, timeToMinutes } from './dates';
import type {
  ClassPattern,
  ISODate,
  PlannerData,
  Session,
  SessionOverride,
} from './types';
import { buildWeeks } from './weeks';

/** Highest `updatedAt` wins among non-deleted overrides for one sessionId. */
function overrideMap(data: PlannerData): Map<string, SessionOverride> {
  const map = new Map<string, SessionOverride>();
  for (const o of data.overrides) {
    if (o.deleted) continue;
    const cur = map.get(o.sessionId);
    if (!cur || o.updatedAt > cur.updatedAt) map.set(o.sessionId, o);
  }
  return map;
}

/** All sessions over the whole semester (overrides applied), unsorted. */
function generate(data: PlannerData, only?: string): Session[] {
  const sem = data.semester;
  if (!sem || sem.deleted) return [];
  const attending = new Set(
    data.subjects.filter((s) => !s.deleted && s.attending).map((s) => s.id),
  );
  const patterns = data.patterns.filter(
    (p) => !p.deleted && attending.has(p.subjectId) && (only === undefined || p.id === only),
  );
  if (patterns.length === 0) return [];
  const overrides = overrideMap(data);
  const weeks = buildWeeks(sem).filter((w) => !w.isBreak);
  const out: Session[] = [];

  for (const p of patterns) {
    const to = p.validTo ?? sem.lastDay;
    for (const w of weeks) {
      if (p.repeat !== 'every' && p.repeat !== w.parity) continue;
      const date = addDays(w.monday, p.weekday - 1);
      if (compareDates(date, sem.firstDay) < 0 || compareDates(date, sem.lastDay) > 0) continue;
      if (compareDates(date, p.validFrom) < 0 || compareDates(date, to) > 0) continue;
      const id = `${p.id}:${date}`;
      const o = overrides.get(id);
      if (o?.kind === 'cancelled') continue;
      out.push(build(p, id, date, o));
    }
  }
  return out;
}

function build(p: ClassPattern, id: string, date: ISODate, o?: SessionOverride): Session {
  const moved = o?.kind === 'moved';
  return {
    id,
    patternId: p.id,
    subjectId: p.subjectId,
    type: p.type,
    date: moved ? (o.date ?? date) : date,
    start: moved ? (o.start ?? p.start) : p.start,
    end: moved ? (o.end ?? p.end) : p.end,
    room: moved ? (o.room ?? p.room) : p.room,
    teacher: p.teacher,
    online: p.online,
    moved,
  };
}

function compareSessions(a: Session, b: Session): number {
  return (
    compareDates(a.date, b.date) ||
    timeToMinutes(a.start) - timeToMinutes(b.start) ||
    (a.patternId < b.patternId ? -1 : a.patternId > b.patternId ? 1 : 0)
  );
}

export function sessionsBetween(data: PlannerData, from: ISODate, to: ISODate): Session[] {
  return generate(data)
    .filter((s) => compareDates(s.date, from) >= 0 && compareDates(s.date, to) <= 0)
    .sort(compareSessions);
}

export function sessionById(data: PlannerData, id: string): Session | null {
  const i = id.lastIndexOf(':');
  if (i <= 0 || i === id.length - 1) return null;
  const patternId = id.slice(0, i);
  return generate(data, patternId).find((s) => s.id === id) ?? null;
}
