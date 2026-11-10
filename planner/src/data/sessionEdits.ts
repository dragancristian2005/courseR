import { changeEveryWeek, moveThisWeek, overrideIdOf, stamp } from '../domain/edits';
import { sessionsBetween } from '../domain/sessions';
import type { ClassPattern, ISODate, PlannerData, Session, SessionOverride } from '../domain/types';
import { newId } from './ids';
import type { Repository } from './repository';

/**
 * The saves behind Move this week, Cancel this week and Change every week, shared by the class
 * screen and dragging on the Week tab.
 */

/** The newest live override of a session, if any. */
export function liveOverrideOf(data: PlannerData, sessionId: string): SessionOverride | undefined {
  return data.overrides
    .filter((o) => !o.deleted && o.sessionId === sessionId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/**
 * Timestamp for a new override of `session`. A removed override stays in the store as a
 * tombstone, and the rules want a strictly newer updatedAt than whatever is stored, so a
 * re-created move or cancellation is stamped above it.
 */
export function overrideStamp(repo: Repository, data: PlannerData, session: Session): number {
  return stamp(
    liveOverrideOf(data, session.id),
    repo.tombstones<SessionOverride>('overrides').find((o) => o.id === overrideIdOf(session)),
  );
}

/**
 * Moves `session` this week. A move back to exactly the pattern's own date, times and room
 * removes the existing move instead (as Undo this week's change does), so the class is no
 * longer marked as moved.
 */
export function saveMoveThisWeek(
  repo: Repository,
  data: PlannerData,
  session: Session,
  to: Parameters<typeof moveThisWeek>[1],
): void {
  const live = liveOverrideOf(data, session.id);
  const pattern = data.patterns.find((p) => p.id === session.patternId);
  const originalDate = session.id.slice(session.id.lastIndexOf(':') + 1);
  const backHome =
    live?.kind === 'moved' &&
    pattern !== undefined &&
    to.date === originalDate &&
    to.start === pattern.start &&
    to.end === pattern.end &&
    (to.room === undefined || to.room === pattern.room);
  if (backHome) {
    void repo.remove('overrides', live.id);
    return;
  }
  void repo.upsert('overrides', moveThisWeek(session, to, overrideStamp(repo, data, session)));
}

/**
 * Ends `pattern` before `from` and starts the changed copy there. Returns the new pattern's
 * session on `on` (default `from`), if it has one.
 */
export function saveChangeEveryWeek(
  repo: Repository,
  data: PlannerData,
  pattern: ClassPattern,
  from: ISODate,
  changes: Parameters<typeof changeEveryWeek>[2],
  on: ISODate = from,
  opts: Parameters<typeof changeEveryWeek>[5] = {},
): Session | undefined {
  const { ended, created } = changeEveryWeek(pattern, from, changes, stamp(pattern), newId, opts);
  void repo.upsert('patterns', ended);
  void repo.upsert('patterns', created);
  const next = {
    ...data,
    patterns: [...data.patterns.filter((p) => p.id !== ended.id), ended, created],
  };
  return sessionsBetween(next, on, on).find((s) => s.patternId === created.id);
}
