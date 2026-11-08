import { createMemoryRepository } from '../../src/data/memoryRepository';
import { emptyPlannerData, Repository } from '../../src/data/repository';
import type { PlannerData, Semester, Subject } from '../../src/domain/types';

const subj = (id: string, updatedAt: number, name = id): Subject => ({
  id,
  updatedAt,
  name,
  abbreviation: name.slice(0, 3),
  attending: true,
});
const sem = (updatedAt: number, name = 's'): Semester => ({
  id: 'sem',
  updatedAt,
  name,
  firstDay: '2026-10-01',
  lastDay: '2027-01-31',
  breaks: [],
  parityOverrides: {},
});

function latest(repo: Repository): { get: () => PlannerData; all: PlannerData[]; off: () => void } {
  const all: PlannerData[] = [];
  const off = repo.subscribe((d) => all.push(d));
  return { get: () => all[all.length - 1], all, off };
}

describe('emptyPlannerData', () => {
  it('has null semester and empty arrays', () => {
    expect(emptyPlannerData()).toEqual({
      semester: null,
      subjects: [],
      patterns: [],
      overrides: [],
      exams: [],
      homework: [],
      notes: [],
      links: [],
      classroomCourses: [],
    });
  });
});

describe('memory repository', () => {
  it('upserts, updates and tombstones classroomCourses', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    const course = { id: 'c1', updatedAt: 1, name: 'Algebra', subjectId: null };
    await repo.upsert('classroomCourses', course);
    expect(s.get().classroomCourses).toEqual([course]);
    await repo.upsert('classroomCourses', { ...course, updatedAt: 2, subjectId: 's1' });
    expect(s.get().classroomCourses[0].subjectId).toBe('s1');
    await repo.remove('classroomCourses', 'c1');
    expect(s.get().classroomCourses).toEqual([]);
  });

  it('subscribe calls back immediately with current data', () => {
    const repo = createMemoryRepository({ subjects: [subj('a', 1)] });
    const s = latest(repo);
    expect(s.all).toHaveLength(1);
    expect(s.get().subjects.map((x) => x.id)).toEqual(['a']);
  });

  it('upsert then subscriber sees the record', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.upsert('subjects', subj('a', 1));
    expect(s.get().subjects).toHaveLength(1);
  });

  it('delivers a new object each time without mutating earlier deliveries', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.upsert('subjects', subj('a', 1));
    const first = s.get();
    await repo.upsert('subjects', subj('b', 1));
    expect(s.get()).not.toBe(first);
    expect(first.subjects).toHaveLength(1);
    expect(s.get().subjects).toHaveLength(2);
  });

  it('remove hides the record from subscribe output', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.upsert('subjects', subj('a', 1));
    await repo.remove('subjects', 'a');
    expect(s.get().subjects).toEqual([]);
  });

  it('tombstoned initial records are not delivered', () => {
    const repo = createMemoryRepository({ subjects: [{ ...subj('a', 1), deleted: true }] });
    expect(latest(repo).get().subjects).toEqual([]);
  });

  it('stale upsert cannot resurrect a removed record', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.upsert('subjects', subj('a', 5));
    await repo.remove('subjects', 'a');
    await repo.upsert('subjects', subj('a', 5));
    await repo.upsert('subjects', subj('a', 6));
    expect(s.get().subjects).toEqual([]);
  });

  it('remove tombstones with updatedAt = max(now, stored + 1)', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(100);
    try {
      const repo = createMemoryRepository();
      await repo.upsert('subjects', subj('a', 500));
      await repo.remove('subjects', 'a');
      // newer than stored 500 but not newer than the tombstone (501): ignored
      await repo.upsert('subjects', subj('a', 501));
      expect(latest(repo).get().subjects).toEqual([]);
      // strictly newer than tombstone resurrects
      await repo.upsert('subjects', subj('a', 502));
      expect(latest(repo).get().subjects).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('remove uses Date.now when it is later than stored', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const repo = createMemoryRepository();
      await repo.upsert('subjects', subj('a', 5));
      await repo.remove('subjects', 'a');
      await repo.upsert('subjects', subj('a', 1000));
      expect(latest(repo).get().subjects).toEqual([]);
      await repo.upsert('subjects', subj('a', 1001));
      expect(latest(repo).get().subjects).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('removing an unknown id is a no-op and does not notify', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.remove('subjects', 'nope');
    expect(s.all).toHaveLength(1);
    expect(s.get().subjects).toEqual([]);
  });

  it('older or equal updatedAt does not overwrite (last write wins)', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.upsert('subjects', subj('a', 10, 'new'));
    await repo.upsert('subjects', subj('a', 5, 'old'));
    expect(s.get().subjects[0].name).toBe('new');
    await repo.upsert('subjects', subj('a', 10, 'same'));
    expect(s.get().subjects[0].name).toBe('new');
    await repo.upsert('subjects', subj('a', 11, 'newer'));
    expect(s.get().subjects[0].name).toBe('newer');
  });

  it('saveSemester stores, and ignores equal or older', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.saveSemester(sem(10, 'a'));
    expect(s.get().semester?.name).toBe('a');
    await repo.saveSemester(sem(10, 'b'));
    await repo.saveSemester(sem(9, 'c'));
    expect(s.get().semester?.name).toBe('a');
    await repo.saveSemester(sem(11, 'd'));
    expect(s.get().semester?.name).toBe('d');
  });

  it('replaceAll replaces everything including semester and notifies once', async () => {
    const repo = createMemoryRepository({ subjects: [subj('a', 1)], semester: sem(1) });
    const s = latest(repo);
    const before = s.all.length;
    await repo.replaceAll({ ...emptyPlannerData(), subjects: [subj('z', 1)] });
    expect(s.all.length).toBe(before + 1);
    expect(s.get().subjects.map((x) => x.id)).toEqual(['z']);
    expect(s.get().semester).toBeNull();
  });

  it('replaceAll data with tombstones are filtered from delivery', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    await repo.replaceAll({
      ...emptyPlannerData(),
      subjects: [{ ...subj('z', 1), deleted: true }],
    });
    expect(s.get().subjects).toEqual([]);
  });

  it('unsubscribe stops deliveries', async () => {
    const repo = createMemoryRepository();
    const s = latest(repo);
    s.off();
    await repo.upsert('subjects', subj('a', 1));
    expect(s.all).toHaveLength(1);
  });
});
