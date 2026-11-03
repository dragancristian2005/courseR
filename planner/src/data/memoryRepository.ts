import type { Base, PlannerData, Semester } from '../domain/types';
import { Collection, Repository, emptyPlannerData } from './repository';

const COLLECTIONS: Collection[] = [
  'subjects',
  'patterns',
  'overrides',
  'exams',
  'homework',
  'notes',
  'links',
];

function clone(data: PlannerData): PlannerData {
  const out = emptyPlannerData();
  out.semester = data.semester ? { ...data.semester } : null;
  for (const c of COLLECTIONS) {
    (out[c] as Base[]) = (data[c] as Base[]).map((r) => ({ ...r }));
  }
  return out;
}

/** Delivered view: copies, with tombstoned records filtered out. */
function visible(data: PlannerData): PlannerData {
  const out = clone(data);
  for (const c of COLLECTIONS) {
    (out[c] as Base[]) = (out[c] as Base[]).filter((r) => !r.deleted);
  }
  if (out.semester?.deleted) out.semester = null;
  return out;
}

export function createMemoryRepository(initial: Partial<PlannerData> = {}): Repository {
  // Tombstones are kept internally so stale upserts cannot resurrect deleted records.
  let state: PlannerData = clone({ ...emptyPlannerData(), ...initial });
  const listeners = new Set<(data: PlannerData) => void>();

  const notify = () => {
    for (const cb of Array.from(listeners)) cb(visible(state));
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      cb(visible(state));
      return () => {
        listeners.delete(cb);
      };
    },

    async upsert<T extends Base>(c: Collection, record: T) {
      const list = state[c] as Base[];
      const idx = list.findIndex((r) => r.id === record.id);
      if (idx >= 0 && record.updatedAt <= list[idx].updatedAt) return;
      const next = list.slice();
      if (idx >= 0) next[idx] = { ...record };
      else next.push({ ...record });
      state = { ...state, [c]: next };
      notify();
    },

    async remove(c, id) {
      const list = state[c] as Base[];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return;
      const stored = list[idx];
      const next = list.slice();
      next[idx] = {
        ...stored,
        deleted: true,
        updatedAt: Math.max(Date.now(), stored.updatedAt + 1),
      };
      state = { ...state, [c]: next };
      notify();
    },

    async saveSemester(s: Semester) {
      if (state.semester && s.updatedAt <= state.semester.updatedAt) return;
      state = { ...state, semester: { ...s } };
      notify();
    },

    async replaceAll(data) {
      state = clone(data);
      notify();
    },
  };
}
