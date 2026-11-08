import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Base, PlannerData, Semester } from '../domain/types';
import { fromDoc, toDoc } from './firestoreMapping';
import { Collection, Repository, emptyPlannerData } from './repository';

const COLLECTIONS: Collection[] = [
  'subjects',
  'patterns',
  'overrides',
  'exams',
  'homework',
  'notes',
  'links',
  'classroomCourses',
];

const BATCH_LIMIT = 450;

type Known = Record<Collection, Map<string, Base>>;

/**
 * Firestore-backed repository. Data lives under users/{uid}/{collection}/{id}, the
 * semester at users/{uid}/meta/semester. Writes never wait for the server, so they work
 * offline; last write wins by comparing against the latest snapshot data held in memory
 * (no transactions, which fail offline). Firestore rules enforce the same ordering.
 * Write methods resolve once the write is queued locally. Listener failures are fatal and go
 * to onError; server rejections of a write (e.g. a lost last-write-wins race) are not fatal,
 * since Firestore reverts the local copy, and go to onWriteError.
 */
export function createFirestoreRepository(db: Firestore, uid: string): Repository {
  const known = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map<string, Base>()])) as Known;
  let knownSemester: Semester | null = null;

  const ref = (c: Collection, id: string) => doc(db, 'users', uid, c, id);
  const semesterRef = () => doc(db, 'users', uid, 'meta', 'semester');

  const semesterDoc = (s: Semester) => ({ ...toDoc(s), id: s.id });

  const assemble = (): PlannerData => {
    const out = emptyPlannerData();
    for (const c of COLLECTIONS) {
      (out[c] as Base[]) = Array.from(known[c].values())
        .filter((r) => !r.deleted)
        .map((r) => ({ ...r }));
    }
    out.semester = knownSemester && !knownSemester.deleted ? { ...knownSemester } : null;
    return out;
  };

  // Active subscribers' write-error callbacks; rejected writes are reported to them.
  const errorSinks = new Set<(e: Error) => void>();
  const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
  const reportWriteError = (e: unknown) => {
    const err = toError(e);
    errorSinks.forEach((sink) => sink(err));
  };

  const tombstoneUpdatedAt = (stored: Base) => Math.max(Date.now(), stored.updatedAt + 1);

  return {
    subscribe(cb, onError, onWriteError) {
      const pending = new Set<string>([...COLLECTIONS, 'semester']);
      const deliver = () => {
        if (pending.size === 0) cb(assemble());
      };
      const unsubs: (() => void)[] = [];
      let failed = false;
      const fail = (e: unknown) => {
        if (failed) return;
        failed = true;
        onError?.(toError(e));
      };
      const writeFailed = (e: Error) => onWriteError?.(e);
      if (onWriteError) errorSinks.add(writeFailed);

      for (const c of COLLECTIONS) {
        unsubs.push(
          onSnapshot(
            collection(db, 'users', uid, c),
            (snap: QuerySnapshot<DocumentData>) => {
              const map = known[c];
              map.clear();
              snap.forEach((d) => map.set(d.id, fromDoc(d.id, d.data())));
              pending.delete(c);
              deliver();
            },
            fail,
          ),
        );
      }
      unsubs.push(
        onSnapshot(
          semesterRef(),
          (snap) => {
            knownSemester = snap.exists()
              ? fromDoc<Semester>(snap.data().id ?? 'semester', snap.data())
              : null;
            pending.delete('semester');
            deliver();
          },
          fail,
        ),
      );

      return () => {
        errorSinks.delete(writeFailed);
        unsubs.forEach((u) => u());
      };
    },

    tombstones<T extends Base = Base>(c: Collection): T[] {
      return Array.from(known[c].values())
        .filter((r) => r.deleted)
        .map((r) => ({ ...r }) as T);
    },

    async upsert<T extends Base>(c: Collection, record: T) {
      const stored = known[c].get(record.id);
      if (stored && record.updatedAt <= stored.updatedAt) return;
      known[c].set(record.id, { ...record });
      setDoc(ref(c, record.id), toDoc(record)).catch(reportWriteError);
    },

    async remove(c, id) {
      const stored = known[c].get(id);
      if (!stored) return;
      const updatedAt = tombstoneUpdatedAt(stored);
      known[c].set(id, { ...stored, deleted: true, updatedAt });
      setDoc(ref(c, id), { deleted: true, updatedAt }, { merge: true }).catch(reportWriteError);
    },

    async saveSemester(s: Semester) {
      if (knownSemester && s.updatedAt <= knownSemester.updatedAt) return;
      knownSemester = { ...s };
      setDoc(semesterRef(), semesterDoc(s)).catch(reportWriteError);
    },

    async replaceAll(data) {
      type Op = { ref: ReturnType<typeof ref>; data: Record<string, unknown>; merge: boolean };
      const ops: Op[] = [];

      for (const c of COLLECTIONS) {
        const incoming = data[c] as Base[];
        const ids = new Set(incoming.map((r) => r.id));
        for (const r of incoming) {
          // Stay strictly newer than what is stored, or the rules would reject the restore.
          const stored = known[c].get(r.id);
          const updatedAt = stored ? Math.max(r.updatedAt, stored.updatedAt + 1) : r.updatedAt;
          const next = { ...r, updatedAt };
          known[c].set(r.id, next);
          ops.push({ ref: ref(c, r.id), data: toDoc(next), merge: false });
        }
        for (const [id, stored] of Array.from(known[c])) {
          if (ids.has(id) || stored.deleted) continue;
          const updatedAt = tombstoneUpdatedAt(stored);
          known[c].set(id, { ...stored, deleted: true, updatedAt });
          ops.push({ ref: ref(c, id), data: { deleted: true, updatedAt }, merge: true });
        }
      }

      if (data.semester) {
        const stored = knownSemester;
        const updatedAt = stored
          ? Math.max(data.semester.updatedAt, stored.updatedAt + 1)
          : data.semester.updatedAt;
        const next = { ...data.semester, updatedAt };
        knownSemester = next;
        ops.push({ ref: semesterRef(), data: semesterDoc(next), merge: false });
      } else if (knownSemester && !knownSemester.deleted) {
        const updatedAt = tombstoneUpdatedAt(knownSemester);
        knownSemester = { ...knownSemester, deleted: true, updatedAt };
        ops.push({ ref: semesterRef(), data: { deleted: true, updatedAt }, merge: true });
      }

      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          if (op.merge) batch.set(op.ref, op.data, { merge: true });
          else batch.set(op.ref, op.data);
        }
        // Offline, commit only settles on server ack, so never await it between chunks.
        batch.commit().catch(reportWriteError);
      }
    },
  };
}
