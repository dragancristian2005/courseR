import type { ClassroomFetch } from '../../src/data/classroom';
import {
  applyClassroomImport,
  planClassroomImport,
  suggestSubject,
  toLocalDue,
  type ClassroomFetched,
} from '../../src/domain/classroomImport';
import type { Homework, PlannerData, Subject } from '../../src/domain/types';

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
      { id: 'c9', name: 'Testarea Sistemelor Software', suggestion: 's2' },
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
  it('returns the course links', () => {
    const links = [{ id: 'c9', name: 'X', subjectId: 's2', updatedAt: 7 }];
    const plan = planClassroomImport(fetched([]), data(), TODAY);
    expect(
      applyClassroomImport(plan, { conflicts: {} }, links, data(), 100, newId).courses,
    ).toEqual(links);
  });
});
