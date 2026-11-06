import { applyDiff, diffImport } from '../../src/domain/importDiff';
import { OPEN_START } from '../../src/domain/edits';
import { sessionsBetween } from '../../src/domain/sessions';
import type { ClassPattern, PlannerData } from '../../src/domain/types';

const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};
const pat = (over: Partial<ClassPattern> = {}): ClassPattern => ({
  id: 'p1',
  updatedAt: 1,
  subjectId: 's1',
  type: 'course',
  weekday: 1,
  start: '08:00',
  end: '10:00',
  room: 'A1',
  teacher: '',
  repeat: 'every',
  validFrom: OPEN_START,
  validTo: null,
  online: false,
  source: 'import',
  ...over,
});
const dataWith = (patterns: ClassPattern[]): PlannerData => ({
  semester: {
    id: 'sem',
    updatedAt: 1,
    name: 'S',
    firstDay: '2026-10-05',
    lastDay: '2026-12-20',
    breaks: [],
    parityOverrides: {},
  },
  subjects: [{ id: 's1', updatedAt: 1, name: 'A', abbreviation: 'A', attending: true }],
  patterns,
  overrides: [],
  exams: [],
  homework: [],
  notes: [],
  links: [],
});

describe('diffImport', () => {
  it('the same sheet is all unchanged, listing existing patterns', () => {
    const data = dataWith([pat({ id: 'p1' }), pat({ id: 'p2', weekday: 2 })]);
    const d = diffImport([pat({ id: '', weekday: 2 }), pat({ id: '' })], data);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.unchanged.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('a moved class is one removed and one added', () => {
    const data = dataWith([pat()]);
    const d = diffImport([pat({ id: '', start: '10:00', end: '12:00' })], data);
    expect(d.removed.map((p) => p.id)).toEqual(['p1']);
    expect(d.added).toHaveLength(1);
    expect(d.unchanged).toEqual([]);
  });

  it('is multiset aware', () => {
    const d = diffImport([pat({ id: '' }), pat({ id: '' })], dataWith([pat()]));
    expect(d.unchanged).toHaveLength(1);
    expect(d.added).toHaveLength(1);
  });

  it('never removes manual, ended or deleted patterns', () => {
    const data = dataWith([
      pat({ id: 'm', source: 'manual' }),
      pat({ id: 'u', source: undefined }),
      pat({ id: 'e', validTo: '2026-11-01' }),
      pat({ id: 'd', deleted: true }),
    ]);
    const d = diffImport([], data);
    expect(d.removed).toEqual([]);
    expect(d.unchanged).toEqual([]);
  });

  it('compares room and online too', () => {
    const data = dataWith([pat()]);
    expect(diffImport([pat({ id: '', room: 'B2' })], data).added).toHaveLength(1);
    expect(diffImport([pat({ id: '', online: true })], data).added).toHaveLength(1);
  });
});

describe('applyDiff', () => {
  it('ends removed the day before from and starts added on from', () => {
    const old = pat();
    const data = dataWith([old]);
    const d = diffImport([pat({ id: '', start: '10:00', end: '12:00' })], data);
    const copy = JSON.stringify(d);
    const out = applyDiff(d, '2026-11-09', 100, counter());
    expect(JSON.stringify(d)).toBe(copy);
    const ended = out.find((p) => p.id === 'p1')!;
    expect(ended.validTo).toBe('2026-11-08');
    expect(ended.deleted).toBeUndefined();
    expect(ended.updatedAt).toBeGreaterThan(old.updatedAt);
    const added = out.find((p) => p.id === 'n1')!;
    expect(added).toMatchObject({
      validFrom: '2026-11-09',
      validTo: null,
      source: 'import',
      updatedAt: 100,
      start: '10:00',
    });
    expect(old.validTo).toBeNull();
  });

  it('tombstones a removed pattern that starts on or after from', () => {
    const old = pat({ validFrom: '2026-11-16' });
    const d = diffImport([], dataWith([old]));
    const out = applyDiff(d, '2026-11-09', 100, counter());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'p1', deleted: true });
  });

  it('leaves earlier sessions unchanged', () => {
    const data = dataWith([pat()]);
    const d = diffImport([pat({ id: '', start: '10:00', end: '12:00' })], data);
    const out = applyDiff(d, '2026-11-09', 100, counter());
    const after: PlannerData = {
      ...data,
      patterns: data.patterns
        .map((p) => out.find((o) => o.id === p.id) ?? p)
        .concat(out.filter((o) => !data.patterns.some((p) => p.id === o.id))),
    };
    const key = (s: { date: string; start: string }) => `${s.date} ${s.start}`;
    const before = sessionsBetween(data, '2026-10-05', '2026-11-08').map(key);
    expect(before.length).toBeGreaterThan(0);
    expect(sessionsBetween(after, '2026-10-05', '2026-11-08').map(key)).toEqual(before);
    const later = sessionsBetween(after, '2026-11-09', '2026-11-15').map(key);
    expect(later).toEqual(['2026-11-09 10:00']);
  });
});
