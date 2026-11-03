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
  /** Calls cb immediately with current data, then on every change. Tombstoned records are filtered out. */
  subscribe(cb: (data: PlannerData) => void): () => void;
  /** Last write wins per record: ignored unless updatedAt is strictly newer than the stored one. */
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
