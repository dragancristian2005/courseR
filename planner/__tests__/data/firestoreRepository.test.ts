import { createFirestoreRepository } from '../../src/data/firestoreRepository';

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();
const mockCommit = jest.fn().mockResolvedValue(undefined);
const listeners: Record<string, (snap: unknown) => void> = {};
const errorListeners: Record<string, (e: Error) => void> = {};

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/'), kind: 'col' }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/'), kind: 'doc' }),
  onSnapshot: (r: { path: string }, cb: (snap: unknown) => void, err: (e: Error) => void) => {
    listeners[r.path] = cb;
    errorListeners[r.path] = err;
    return () => {
      delete listeners[r.path];
    };
  },
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  writeBatch: () => ({ set: mockBatchSet, commit: mockCommit }),
}));

const COLS = [
  'subjects',
  'patterns',
  'overrides',
  'exams',
  'homework',
  'notes',
  'links',
  'classroomCourses',
];
const colSnap = (docs: Record<string, object>) => ({
  forEach: (fn: (d: { id: string; data: () => object }) => void) =>
    Object.entries(docs).forEach(([id, d]) => fn({ id, data: () => d })),
});
const emit = (c: string, docs: Record<string, object> = {}) =>
  listeners[`users/u1/${c}`](colSnap(docs));
const emitSemester = (data?: object) =>
  listeners['users/u1/meta/semester']({ exists: () => !!data, data: () => data });

const subj = (id: string, updatedAt: number, extra = {}) => ({
  id,
  updatedAt,
  name: id,
  abbreviation: id,
  attending: true,
  ...extra,
});
const stripId = ({ id: _id, ...rest }: { id: string }) => rest;

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(listeners)) delete listeners[k];
});

describe('firestore repository', () => {
  it('delivers only after every listener reported, filtering tombstones, and tears down', () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    const cb = jest.fn();
    const unsub = repo.subscribe(cb);
    for (const c of COLS.slice(1)) emit(c);
    emitSemester();
    expect(cb).not.toHaveBeenCalled();
    emit('subjects', { a: stripId(subj('a', 1)), b: stripId(subj('b', 2, { deleted: true })) });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].subjects.map((s: { id: string }) => s.id)).toEqual(['a']);
    expect(cb.mock.calls[0][0].semester).toBeNull();
    unsub();
    expect(Object.keys(listeners)).toHaveLength(0);
  });

  it('stores and delivers classroomCourses under users/{uid}/classroomCourses', async () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    const cb = jest.fn();
    repo.subscribe(cb);
    for (const c of COLS) emit(c);
    emitSemester();
    const course = { id: '123', updatedAt: 3, name: 'Algebra', subjectId: null };
    await repo.upsert('classroomCourses', course);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1/classroomCourses/123' }),
      stripId(course),
    );
    emit('classroomCourses', { '123': stripId(course) });
    expect(cb.mock.calls[cb.mock.calls.length - 1][0].classroomCourses).toEqual([course]);
  });

  it('skips an upsert that is not strictly newer than the known record', async () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    repo.subscribe(() => {});
    emit('subjects', { a: stripId(subj('a', 10)) });
    await repo.upsert('subjects', subj('a', 10));
    await repo.upsert('subjects', subj('a', 9));
    expect(mockSetDoc).not.toHaveBeenCalled();
    await repo.upsert('subjects', subj('a', 11));
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/u1/subjects/a' }),
      stripId(subj('a', 11)),
    );
  });

  it('removes with a merged tombstone, and ignores unknown ids', async () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    repo.subscribe(() => {});
    const stored = Date.now() + 100000;
    emit('subjects', { a: stripId(subj('a', stored)) });
    await repo.remove('subjects', 'zzz');
    expect(mockSetDoc).not.toHaveBeenCalled();
    await repo.remove('subjects', 'a');
    const [, body, opts] = mockSetDoc.mock.calls[0];
    expect(body).toEqual({ deleted: true, updatedAt: stored + 1 });
    expect(opts).toEqual({ merge: true });
  });

  it('replaceAll batches in chunks of at most 450 and tombstones missing records', async () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    repo.subscribe(() => {});
    emit('subjects', { old: stripId(subj('old', 1)) });
    const many = Array.from({ length: 900 }, (_, i) => subj(`s${i}`, 5));
    await repo.replaceAll({
      semester: null,
      subjects: many,
      patterns: [],
      overrides: [],
      exams: [],
      homework: [],
      notes: [],
      links: [],
      classroomCourses: [],
    });
    expect(mockBatchSet).toHaveBeenCalledTimes(901);
    expect(mockCommit).toHaveBeenCalledTimes(3);
    const tomb = mockBatchSet.mock.calls.find((c) => c[0].path === 'users/u1/subjects/old');
    expect(tomb[1]).toEqual(expect.objectContaining({ deleted: true }));
    expect(tomb[2]).toEqual({ merge: true });
  });

  it('reports a listener error once through onError', () => {
    const repo = createFirestoreRepository({} as never, 'u1');
    const onError = jest.fn();
    repo.subscribe(() => {}, onError);
    errorListeners['users/u1/subjects'](new Error('permission-denied'));
    errorListeners['users/u1/notes'](new Error('permission-denied'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('permission-denied');
  });

  it('resolves writes without waiting for server acknowledgement', async () => {
    const never = new Promise<void>(() => {});
    mockSetDoc.mockReturnValue(never);
    mockCommit.mockReturnValue(never);
    try {
      const repo = createFirestoreRepository({} as never, 'u1');
      await repo.upsert('subjects', subj('a', 1));
      await repo.saveSemester({
        id: 's',
        updatedAt: 1,
        name: 'n',
        firstDay: '2026-10-01',
        lastDay: '2027-01-31',
        breaks: [],
        parityOverrides: {},
      });
      await repo.replaceAll({
        semester: null,
        subjects: Array.from({ length: 1000 }, (_, i) => subj(`s${i}`, 5)),
        patterns: [],
        overrides: [],
        exams: [],
        homework: [],
        notes: [],
        links: [],
        classroomCourses: [],
      });
      expect(mockCommit).toHaveBeenCalledTimes(3);
    } finally {
      mockSetDoc.mockResolvedValue(undefined);
      mockCommit.mockResolvedValue(undefined);
    }
  });

  it('forwards a rejected write to onWriteError, not the fatal onError', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('denied'));
    const repo = createFirestoreRepository({} as never, 'u1');
    const onError = jest.fn();
    const onWriteError = jest.fn();
    repo.subscribe(() => {}, onError, onWriteError);
    await repo.upsert('subjects', subj('a', 1));
    await new Promise((r) => setTimeout(r, 0));
    expect(onWriteError).toHaveBeenCalledTimes(1);
    expect(onWriteError.mock.calls[0][0].message).toBe('denied');
    expect(onError).not.toHaveBeenCalled();
  });
});
