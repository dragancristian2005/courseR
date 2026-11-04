import type { Base, PlannerData, Semester } from '../domain/types';

export type Collection =
  | 'subjects'
  | 'patterns'
  | 'overrides'
  | 'exams'
  | 'homework'
  | 'notes'
  | 'links';

export interface Repository {
  /**
   * Calls cb with current data (immediately for in-memory stores, after the first server/cache
   * read for Firestore), then on every change. Tombstoned records are filtered out.
   * onError is called if the data can no longer be loaded (fatal). onWriteError is called when
   * the server rejects a write (not fatal: the local copy is reverted to the newer version).
   */
  subscribe(
    cb: (data: PlannerData) => void,
    onError?: (e: Error) => void,
    onWriteError?: (e: Error) => void,
  ): () => void;
  /**
   * Last write wins per record: ignored unless updatedAt is strictly newer than the stored one.
   * Write methods resolve once the write is queued locally, not when the server acknowledges it.
   */
  upsert<T extends Base>(c: Collection, record: T): Promise<void>;
  /** Writes a tombstone (never a hard delete). Unknown id is a no-op. */
  remove(c: Collection, id: string): Promise<void>;
  saveSemester(s: Semester): Promise<void>;
  /** Replaces everything (including semester); used by backup restore. */
  replaceAll(data: PlannerData): Promise<void>;
}

export function emptyPlannerData(): PlannerData {
  return {
    semester: null,
    subjects: [],
    patterns: [],
    overrides: [],
    exams: [],
    homework: [],
    notes: [],
    links: [],
  };
}
