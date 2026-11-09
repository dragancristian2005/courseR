import type { ClassroomFetch } from '../../src/data/classroom';
import {
  applyClassroomImport,
  planClassroomImport,
  suggestSubject,
  toLocalDue,
  type ClassroomFetched,
} from '../../src/domain/classroomImport';
import type { Homework, PlannerData, Semester, Subject } from '../../src/domain/types';

const _check: ClassroomFetched = {} as ClassroomFetch;
void _check;

const subj = (id: string, name: string, abbreviation: string, extra: Partial<Subject> = {}) =>
  ({ id, name, abbreviation, attending: true, updatedAt: 1, ...extra }) as Subject;

const data = (over: Partial<PlannerData> = {}): PlannerData => ({
  semester: null,
  subjects: [subj('s1', 'Baze de date', 'BD'), subj('s2', 'Testarea Sistemelor Software', 'TSS')],
  patterns: [],
  overrides: [],
  exams: [],
  homework: [],
  notes: [],
  links: [],
  classroomCourses: [{ id: 'c1', name: 'BD', subjectId: 's1', updatedAt: 1 }],
  ...over,
});

const work = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  courseId: 'c1',
  title: `T ${id}`,
  dueDate: { year: 2026, month: 11, day: 20 },
  dueTime: null,
  ...over,
});

const fetched = (w: ReturnType<typeof work>[], turnedIn: string[] = []): ClassroomFetched => ({
  courses: [{ id: 'c1', name: 'BD', section: null }],
  work: w,
  turnedIn: new Set(turnedIn),
});

const TODAY = '2026-11-08';

const semester = (firstDay: string): Semester =>
  ({
    id: 'semester',
    updatedAt: 1,
    name: 'Autumn',
    firstDay,
    lastDay: '2027-01-20',
    breaks: [],
    parityOverrides: {},
  }) as Semester;

const hw = (over: Partial<Homework> = {}): Homework => ({
  id: 'h1',
  title: 'T w1',
  subjectId: 's1',
  due: '2026-11-20',
  dueTime: null,
  done: false,
  source: 'classroom',
  externalId: 'w1',
  imported: { title: 'T w1', due: '2026-11-20', dueTime: null },
  updatedAt: 5,
  ...over,
});

describe('toLocalDue', () => {
  it('converts UTC to Bucharest (winter, +2)', () => {
    expect(toLocalDue({ year: 2026, month: 11, day: 12 }, { hours: 23, minutes: 59 })).toEqual({
      due: '2026-11-13',
      dueTime: '01:59',
    });
  });
  it('converts UTC to Bucharest (summer, +3)', () => {
    expect(toLocalDue({ year: 2026, month: 6, day: 30 }, { hours: 22 })).toEqual({
      due: '2026-07-01',
      dueTime: '01:00',
    });
  });
  it('keeps the date without a time, and handles no date', () => {
    expect(toLocalDue({ year: 2026, month: 11, day: 12 }, null)).toEqual({
      due: '2026-11-12',
      dueTime: null,
    });
    expect(toLocalDue(null, null)).toEqual({ due: null, dueTime: null });
  });
  it('converts on the autumn DST switch day (EEST to EET at 01:00Z)', () => {
    const day = { year: 2026, month: 10, day: 25 };
    expect(toLocalDue(day, { hours: 0, minutes: 59 })).toEqual({
      due: '2026-10-25',
      dueTime: '03:59',
    });
    expect(toLocalDue(day, { hours: 1 })).toEqual({ due: '2026-10-25', dueTime: '03:00' });
  });
  it('converts on the spring DST switch day (EET to EEST at 01:00Z)', () => {
    const day = { year: 2027, month: 3, day: 28 };
    expect(toLocalDue(day, { hours: 0, minutes: 30 })).toEqual({
      due: '2027-03-28',
      dueTime: '02:30',
    });
    expect(toLocalDue(day, { hours: 1 })).toEqual({ due: '2027-03-28', dueTime: '04:00' });
  });
  it('treats missing minutes as 0', () => {
    expect(toLocalDue({ year: 2026, month: 11, day: 12 }, { minutes: 30 })).toEqual({
      due: '2026-11-12',
      dueTime: '02:30',
    });
  });
});

describe('suggestSubject', () => {
  const subjects = data().subjects;
  it('matches by initials', () => {
    expect(suggestSubject('Testarea Sistemelor Software', subjects)).toBe('s2');
  });
  it('matches by folded full name', () => {
    expect(suggestSubject('BAZE DE DATE', subjects)).toBe('s1');
    expect(suggestSubject('Ștefan', [subj('x', 'Stefan', 'ST')])).toBe('x');
  });
  it('matches by abbreviation', () => {
    expect(suggestSubject('bd', subjects)).toBe('s1');
  });
  it('ignores non-attending and deleted subjects', () => {
    expect(suggestSubject('BD', [subj('a', 'x', 'BD', { attending: false })])).toBeNull();
    expect(suggestSubject('BD', [subj('a', 'x', 'BD', { deleted: true })])).toBeNull();
  });
  it('returns null when nothing or several match', () => {
    expect(suggestSubject('Fizica', subjects)).toBeNull();
    expect(suggestSubject('BD', [subj('a', 'x', 'BD'), subj('b', 'y', 'bd')])).toBeNull();
  });
});

describe('planClassroomImport', () => {
  it('lists unlinked courses with suggestions and imports nothing for them', () => {
    const f: ClassroomFetched = {
      courses: [{ id: 'c9', name: 'Testarea Sistemelor Software', section: null }],
      work: [work('w1', { courseId: 'c9' })],
      turnedIn: new Set(),
    };
    const p = planClassroomImport(f, data(), TODAY);
    expect(p.unlinkedCourses).toEqual([
      { id: 'c9', name: 'Testarea Sistemelor Software', suggestion: 's2', importable: true },
    ]);
    expect(p.items).toEqual([]);
  });
  it('treats a tombstoned course link as unlinked', () => {
    const d = data({
      classroomCourses: [{ id: 'c1', name: 'BD', subjectId: 's1', updatedAt: 1, deleted: true }],
    });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.unlinkedCourses.map((c) => c.id)).toEqual(['c1']);
    expect(p.items).toEqual([]);
  });
  it('treats a link to a deleted or missing subject as unlinked, with a suggestion', () => {
    const d = data({
      subjects: [
        subj('s1', 'Baze de date', 'BD', { deleted: true }),
        subj('s3', 'Baze de date', 'BD2'),
      ],
      classroomCourses: [
        { id: 'c1', name: 'Baze de date', subjectId: 's1', updatedAt: 1 },
        { id: 'c2', name: 'Gone', subjectId: 'nope', updatedAt: 1 },
      ],
    });
    const f: ClassroomFetched = {
      courses: [
        { id: 'c1', name: 'Baze de date', section: null },
        { id: 'c2', name: 'Gone', section: null },
      ],
      work: [work('w1'), work('w2', { courseId: 'c2' })],
      turnedIn: new Set(),
    };
    const p = planClassroomImport(f, d, TODAY);
    expect(p.unlinkedCourses).toEqual([
      { id: 'c1', name: 'Baze de date', suggestion: 's3', importable: true },
      { id: 'c2', name: 'Gone', suggestion: null, importable: true },
    ]);
    expect(p.items).toEqual([]);
  });
  it('plans nothing for a course linked to a subject that is switched off', () => {
    const d = data({ subjects: [subj('s1', 'Baze de date', 'BD', { attending: false })] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.unlinkedCourses).toEqual([]);
    expect(p.items).toEqual([]);
  });
  it('tells whether an unlinked course has anything to import', () => {
    const past = { dueDate: { year: 2026, month: 9, day: 1 } };
    const f: ClassroomFetched = {
      courses: [
        { id: 'old', name: 'Old', section: null },
        { id: 'undated', name: 'Undated', section: null },
        { id: 'future', name: 'Future', section: null },
        { id: 'overdue', name: 'Overdue', section: null },
        { id: 'empty', name: 'Empty', section: null },
      ],
      work: [
        work('o1', { courseId: 'old', ...past }),
        work('o2', { courseId: 'old', dueDate: { year: 2026, month: 11, day: 1 } }),
        work('u1', { courseId: 'undated', dueDate: null }),
        work('f1', { courseId: 'future' }),
        work('v1', { courseId: 'overdue', dueDate: { year: 2026, month: 10, day: 2 } }),
      ],
      turnedIn: new Set(['o2', 'u1']),
    };
    const d = data({ semester: semester('2026-10-01'), classroomCourses: [] });
    const p = planClassroomImport(f, d, TODAY);
    expect(Object.fromEntries(p.unlinkedCourses.map((c) => [c.id, c.importable]))).toEqual({
      old: false,
      undated: true,
      future: true,
      overdue: true,
      empty: false,
    });
  });
  it('lists the courses with something to import, linked or not', () => {
    const past = { dueDate: { year: 2025, month: 3, day: 1 } };
    const f: ClassroomFetched = {
      courses: [
        { id: 'c1', name: 'BD', section: null },
        { id: 'old', name: 'CPOC 2024-2025', section: null },
        { id: 'new', name: 'New', section: null },
      ],
      work: [work('w1'), work('o1', { courseId: 'old', ...past }), work('n1', { courseId: 'new' })],
      turnedIn: new Set(['o1']),
    };
    const p = planClassroomImport(f, data(), TODAY);
    expect(p.activeCourseIds).toEqual(['c1', 'new']);
  });
  it('undated work posted before the semester started does not count; this semester’s does', () => {
    const f: ClassroomFetched = {
      courses: [
        { id: 'old', name: 'CPOC 2024-2025 FMI', section: null },
        { id: 'now', name: 'Now', section: null },
      ],
      work: [
        work('o1', { courseId: 'old', dueDate: null, created: '2024-10-15T09:00:00Z' }),
        work('n1', { courseId: 'now', dueDate: null, created: '2026-10-05T09:00:00Z' }),
      ],
      turnedIn: new Set(['o1']),
    };
    const d = data({ semester: semester('2026-10-01'), classroomCourses: [] });
    const p = planClassroomImport(f, d, TODAY);
    expect(p.activeCourseIds).toEqual(['now']);
  });
  it('undated work posted late on the eve of the semester counts by Bucharest date', () => {
    const f: ClassroomFetched = {
      courses: [{ id: 'c1', name: 'BD', section: null }],
      // 22:30 UTC on 30 Sep is 01:30 on 1 Oct in Bucharest (summer time, +3).
      work: [work('w1', { dueDate: null, created: '2026-09-30T22:30:00Z' })],
      turnedIn: new Set(),
    };
    const d = data({ semester: semester('2026-10-01') });
    expect(planClassroomImport(f, d, TODAY).items.map((i) => i.workId)).toEqual(['w1']);
  });
  it('undated work with no creation time still counts', () => {
    const d = data({ semester: semester('2026-10-01') });
    const p = planClassroomImport(fetched([work('w1', { dueDate: null })]), d, TODAY);
    expect(p.items.map((i) => i.workId)).toEqual(['w1']);
  });
  it('a course whose only work the student deleted has nothing to import', () => {
    const d = data({ classroomCourses: [], homework: [hw({ deleted: true })] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.unlinkedCourses[0].importable).toBe(false);
  });
  it("skips courses set to Don't import", () => {
    const d = data({ classroomCourses: [{ id: 'c1', name: 'BD', subjectId: null, updatedAt: 1 }] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.unlinkedCourses).toEqual([]);
    expect(p.items).toEqual([]);
  });
  it('applies the include rules', () => {
    const past = { dueDate: { year: 2026, month: 11, day: 1 } };
    const f = fetched(
      [
        work('none', { dueDate: null }),
        work('future'),
        work('overdue', past),
        work('overdueDone', past),
      ],
      ['overdueDone'],
    );
    const ids = planClassroomImport(f, data(), TODAY).items.map((i) => i.workId);
    expect(ids.sort()).toEqual(['future', 'none', 'overdue']);
  });
  it('skips new work due before the semester’s first day', () => {
    const f = fetched([
      work('before', { dueDate: { year: 2026, month: 9, day: 30 } }),
      work('first', { dueDate: { year: 2026, month: 10, day: 1 } }),
      work('none', { dueDate: null }),
      work('future'),
    ]);
    const ids = planClassroomImport(f, data({ semester: semester('2026-10-01') }), TODAY).items;
    expect(ids.map((i) => i.workId).sort()).toEqual(['first', 'future', 'none']);
  });
  it('compares the cutoff with the local due date', () => {
    // 22:30Z on 30 September is 01:30 on 1 October in Bucharest.
    const f = fetched([
      work('late', {
        dueDate: { year: 2026, month: 9, day: 30 },
        dueTime: { hours: 22, minutes: 30 },
      }),
    ]);
    const p = planClassroomImport(f, data({ semester: semester('2026-10-01') }), TODAY);
    expect(p.items.map((i) => i.workId)).toEqual(['late']);
  });
  it('has no cutoff without a semester', () => {
    const f = fetched([work('old', { dueDate: { year: 2025, month: 3, day: 1 } })]);
    expect(planClassroomImport(f, data(), TODAY).items.map((i) => i.workId)).toEqual(['old']);
  });
  it('still evaluates imported homework due before the cutoff', () => {
    const old = { title: 'T w1', due: '2026-09-01', dueTime: null };
    const d = data({
      semester: semester('2026-10-01'),
      homework: [hw({ due: '2026-09-01', imported: old as Homework['imported'] })],
    });
    const f = fetched([work('w1', { dueDate: { year: 2026, month: 9, day: 1 } })], ['w1']);
    expect(planClassroomImport(f, d, TODAY).items[0]).toMatchObject({
      action: 'update',
      done: true,
    });
  });
  it('marks turned-in work done', () => {
    const p = planClassroomImport(fetched([work('w1')], ['w1']), data(), TODAY);
    expect(p.items[0]).toMatchObject({ action: 'new', done: true });
  });
  it('converts the due date to local time', () => {
    const f = fetched([
      work('w1', {
        dueDate: { year: 2026, month: 11, day: 12 },
        dueTime: { hours: 23, minutes: 59 },
      }),
    ]);
    expect(planClassroomImport(f, data(), TODAY).items[0]).toMatchObject({
      due: '2026-11-13',
      dueTime: '01:59',
    });
  });
  it('reports re-imported unchanged data as unchanged', () => {
    const d = data({ homework: [hw()] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.items.map((i) => i.action)).toEqual(['unchanged']);
  });
  it('updates when only Classroom changed', () => {
    const d = data({ homework: [hw()] });
    const p = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    expect(p.items[0].action).toBe('update');
  });
  it('keeps the student edit when only the student changed', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.items[0].action).toBe('unchanged');
  });
  it('flags a conflict when both changed', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const p = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    expect(p.items[0].action).toBe('conflict');
  });
  it('ticks existing homework done when turned in later, even if overdue', () => {
    const d = data({
      homework: [
        hw({ due: '2026-11-01', imported: { title: 'T w1', due: '2026-11-01', dueTime: null } }),
      ],
    });
    const f = fetched([work('w1', { dueDate: { year: 2026, month: 11, day: 1 } })], ['w1']);
    const p = planClassroomImport(f, d, TODAY);
    expect(p.items[0]).toMatchObject({ action: 'update', done: true });
  });
  it('edited and then turned in: update, keeps the edit, sets done', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const plan = planClassroomImport(fetched([work('w1')], ['w1']), d, TODAY);
    expect(plan.items[0]).toMatchObject({ action: 'update', done: true });
    const [h] = applyClassroomImport(plan, { conflicts: {} }, [], d, 100, () => 'x').homework;
    expect(h).toMatchObject({ title: 'Mine', done: true });
  });
  it('refreshes a stale snapshot when the student’s edit matches Classroom’s new values', () => {
    const d = data({ homework: [hw({ title: 'New' })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    expect(plan.items[0].action).toBe('refresh');
    const [h] = applyClassroomImport(plan, { conflicts: {} }, [], d, 10 ** 16, () => 'x').homework;
    expect(h).toEqual({
      ...hw({ title: 'New' }),
      imported: { title: 'New', due: '2026-11-20', dueTime: null },
      updatedAt: expect.any(Number),
    });
    expect(h.updatedAt).toBeGreaterThan(5);
    const later = planClassroomImport(
      fetched([work('w1', { title: 'Newer' })]),
      data({ homework: [h] }),
      TODAY,
    );
    expect(later.items[0].action).toBe('update');
  });
  it('a done change with matching fields is still a visible update, not a refresh', () => {
    const d = data({ homework: [hw({ title: 'New' })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })], ['w1']), d, TODAY);
    expect(plan.items[0]).toMatchObject({ action: 'update', done: true });
  });
  it('never un-does a homework the student ticked', () => {
    const d = data({ homework: [hw({ done: true })] });
    const p = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(p.items[0]).toMatchObject({ action: 'unchanged', done: true });
  });
  it('never brings back a deleted homework', () => {
    const d = data({ homework: [hw({ deleted: true })] });
    expect(planClassroomImport(fetched([work('w1')]), d, TODAY).items).toEqual([]);
  });
  it('ignores typed homework with the same id', () => {
    const typed = hw({ source: undefined, externalId: undefined, imported: undefined });
    const p = planClassroomImport(fetched([work('w1')]), data({ homework: [typed] }), TODAY);
    expect(p.items[0].action).toBe('new');
  });
  it('orders by subject, then due (null last), then title', () => {
    const d = data({
      classroomCourses: [
        { id: 'c1', name: 'BD', subjectId: 's1', updatedAt: 1 },
        { id: 'c2', name: 'TSS', subjectId: 's2', updatedAt: 1 },
      ],
    });
    const f: ClassroomFetched = {
      courses: [
        { id: 'c1', name: 'BD', section: null },
        { id: 'c2', name: 'TSS', section: null },
      ],
      work: [
        work('c', { courseId: 'c2', title: 'A' }),
        work('b', { title: 'B', dueDate: null }),
        work('a2', { title: 'Z' }),
        work('a1', { title: 'A' }),
        work('a0', { title: 'Early', dueDate: { year: 2026, month: 11, day: 9 } }),
      ],
      turnedIn: new Set(),
    };
    const ids = planClassroomImport(f, d, TODAY).items.map((i) => i.workId);
    expect(ids).toEqual(['a0', 'a1', 'a2', 'b', 'c']);
  });
});

describe('applyClassroomImport', () => {
  let n = 0;
  const newId = () => `new${++n}`;

  it('creates new homework with source, externalId and snapshot', () => {
    const plan = planClassroomImport(fetched([work('w1')]), data(), TODAY);
    const out = applyClassroomImport(plan, { conflicts: {} }, [], data(), 100, newId);
    expect(out.homework).toHaveLength(1);
    expect(out.homework[0]).toMatchObject({
      title: 'T w1',
      subjectId: 's1',
      due: '2026-11-20',
      done: false,
      source: 'classroom',
      externalId: 'w1',
      imported: { title: 'T w1', due: '2026-11-20', dueTime: null },
      updatedAt: 100,
    });
  });
  it('saves nothing for unchanged items', () => {
    const d = data({ homework: [hw()] });
    const plan = planClassroomImport(fetched([work('w1')]), d, TODAY);
    expect(applyClassroomImport(plan, { conflicts: {} }, [], d, 100, newId).homework).toEqual([]);
  });
  it('updates with a newer stamp and fresh snapshot', () => {
    const d = data({ homework: [hw({ updatedAt: 10 ** 15 })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    const [h] = applyClassroomImport(plan, { conflicts: {} }, [], d, 100, newId).homework;
    expect(h).toMatchObject({ id: 'h1', title: 'New', imported: { title: 'New' } });
    expect(h.updatedAt).toBe(10 ** 15 + 1);
  });
  it('resolves a conflict with "mine": keeps fields, refreshes snapshot', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    const [h] = applyClassroomImport(
      plan,
      { conflicts: { w1: 'mine' } },
      [],
      d,
      100,
      newId,
    ).homework;
    expect(h.title).toBe('Mine');
    expect(h.imported?.title).toBe('New');
    const again = planClassroomImport(
      fetched([work('w1', { title: 'New' })]),
      data({ homework: [h] }),
      TODAY,
    );
    expect(again.items[0].action).toBe('unchanged');
  });
  it('resolves a conflict with "classroom"', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    const [h] = applyClassroomImport(
      plan,
      { conflicts: { w1: 'classroom' } },
      [],
      d,
      100,
      newId,
    ).homework;
    expect(h.title).toBe('New');
  });
  it('treats a missing conflict answer as "mine"', () => {
    const d = data({ homework: [hw({ title: 'Mine' })] });
    const plan = planClassroomImport(fetched([work('w1', { title: 'New' })]), d, TODAY);
    const [h] = applyClassroomImport(plan, { conflicts: {} }, [], d, 100, newId).homework;
    expect(h).toMatchObject({ title: 'Mine', imported: { title: 'New' } });
  });
  it('re-planning after apply leaves everything unchanged', () => {
    const d = data({
      homework: [
        hw({ id: 'h2', externalId: 'w2', title: 'T w2', imported: undefined }),
        hw({ id: 'h3', externalId: 'w3', title: 'Mine' }),
      ],
    });
    const f = fetched([work('w1'), work('w2', { title: 'Changed' }), work('w3', { title: 'X' })]);
    const plan = planClassroomImport(f, d, TODAY);
    expect(plan.items.map((i) => [i.workId, i.action]).sort()).toEqual([
      ['w1', 'new'],
      ['w2', 'update'],
      ['w3', 'conflict'],
    ]);
    const out = applyClassroomImport(plan, { conflicts: { w3: 'classroom' } }, [], d, 100, newId);
    const after = data({ homework: out.homework });
    expect(planClassroomImport(f, after, TODAY).items.map((i) => i.action)).toEqual([
      'unchanged',
      'unchanged',
      'unchanged',
    ]);
  });
  it('returns the course links', () => {
    const links = [{ id: 'c9', name: 'X', subjectId: 's2', updatedAt: 7 }];
    const plan = planClassroomImport(fetched([]), data(), TODAY);
    expect(
      applyClassroomImport(plan, { conflicts: {} }, links, data(), 100, newId).courses,
    ).toEqual(links);
  });
});
