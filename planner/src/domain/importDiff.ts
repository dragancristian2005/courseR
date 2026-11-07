import { addDays, compareDates } from './dates';
import { stamp } from './edits';
import { patternSignature } from './importPlan';
import type { ClassPattern, ISODate, PlannerData } from './types';

export interface ImportDiff {
  added: ClassPattern[];
  removed: ClassPattern[];
  unchanged: ClassPattern[];
}

const sig = patternSignature;

/**
 * Compare a re-imported timetable with what an earlier import left in the planner. Only live,
 * open-ended import patterns can be removed or unchanged; manual classes are never touched.
 * `unchanged` holds the existing patterns, `added` the new ones with no match.
 */
export function diffImport(newPatterns: ClassPattern[], data: PlannerData): ImportDiff {
  const existing = data.patterns.filter(
    (p) => !p.deleted && p.source === 'import' && p.validTo === null,
  );
  const pool = new Map<string, ClassPattern[]>();
  for (const p of existing) {
    const list = pool.get(sig(p)) ?? [];
    list.push(p);
    pool.set(sig(p), list);
  }
  const added: ClassPattern[] = [];
  const unchanged: ClassPattern[] = [];
  for (const n of newPatterns) {
    const match = pool.get(sig(n))?.shift();
    if (match === undefined) added.push(n);
    else unchanged.push(match);
  }
  const removed = [...pool.values()].flat();
  return { added, removed, unchanged };
}

/**
 * The records to save for a diff taking effect on `from`: removed classes end the day before
 * (or are deleted if they never started before `from`), added ones begin on `from`.
 * Weeks before `from` keep their sessions.
 */
export function applyDiff(
  diff: ImportDiff,
  from: ISODate,
  now: number,
  newId: () => string,
): ClassPattern[] {
  const out: ClassPattern[] = [];
  for (const p of diff.removed) {
    const r: ClassPattern = { ...p, updatedAt: stamp(p) };
    if (compareDates(from, p.validFrom) <= 0) r.deleted = true;
    else r.validTo = addDays(from, -1);
    out.push(r);
  }
  for (const p of diff.added) {
    const a: ClassPattern = {
      ...p,
      id: newId(),
      validFrom: from,
      validTo: null,
      source: 'import',
      updatedAt: now,
    };
    delete a.deleted;
    out.push(a);
  }
  return out;
}
