import { createFirestoreRepository } from '../../src/data/firestoreRepository';

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();
const mockCommit = jest.fn().mockResolvedValue(undefined);
const listeners: Record<string, (snap: unknown) => void> = {};

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/'), kind: 'col' }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/'), kind: 'doc' }),
  onSnapshot: (r: { path: string }, cb: (snap: unknown) => void) => {
    listeners[r.path] = cb;
    return () => {
      delete listeners[r.path];
    };
  },
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  writeBatch: () => ({ set: mockBatchSet, commit: mockCommit }),
}));

const COLS = ['subjects', 'patterns', 'overrides', 'exams', 'homework', 'notes', 'links'];
const colSnap = (docs: Record<string, object>) => ({
  forEach: (fn: (d: { id: string; data: () => object }) => void) =>
    Object.entries(docs).forEach(([id, d]) => fn({ id, data: () => d })),
});
const emit = (c: string, docs: Record<string, object> = {}) => listeners[`users/u1/${c}`](colSnap(docs));
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
    emit('subjects', { a: stripId(subj('a', Date.now() + 100000)) });
    await repo.remove('subjects', 'zzz');
    expect(mockSetDoc).not.toHaveBeenCalled();
    const stored = Date.now() + 100000;
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
    });
    expect(mockBatchSet).toHaveBeenCalledTimes(901);
    expect(mockCommit).toHaveBeenCalledTimes(3);
    const tomb = mockBatchSet.mock.calls.find((c) => c[0].path === 'users/u1/subjects/old');
    expect(tomb[1]).toEqual(expect.objectContaining({ deleted: true }));
    expect(tomb[2]).toEqual({ merge: true });
  });
});
