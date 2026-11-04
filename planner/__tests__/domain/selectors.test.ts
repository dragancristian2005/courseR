import {
  dueLabel,
  homeworkGroups,
  linksBySubject,
  nextExam,
  notesFor,
  todayAgenda,
} from '../../src/domain/selectors';
import type {
  ClassPattern,
  Exam,
  Homework,
  Link,
  Note,
  PlannerData,
  Subject,
} from '../../src/domain/types';

const TSS: Subject = { id: 'tss', updatedAt: 0, name: 'TSS', abbreviation: 'TSS', attending: true };
const ALG: Subject = {
  id: 'alg',
  updatedAt: 0,
  name: 'Algebra',
  abbreviation: 'ALG',
  attending: true,
};
const OFF: Subject = {
  id: 'off',
  updatedAt: 0,
  name: 'Off',
  abbreviation: 'OFF',
  attending: false,
};

const pat = (over: Partial<ClassPattern>): ClassPattern => ({
  id: 'p1',
  updatedAt: 0,
  subjectId: 'tss',
  type: 'seminar',
  weekday: 1,
  start: '09:40',
  end: '11:10',
  room: '048',
  teacher: 'T',
  repeat: 'every',
  validFrom: '2026-09-28',
  validTo: null,
  online: false,
  ...over,
});

const p1 = pat({});
const p2 = pat({ id: 'p2', start: '11:20', end: '12:50' });

function make(over: Partial<PlannerData> = {}): PlannerData {
  return {
    semester: {
      id: 's1',
      updatedAt: 0,
      name: 'Fall',
      firstDay: '2026-09-28',
      lastDay: '2027-01-15',
      breaks: [{ from: '2026-12-21', to: '2027-01-03' }],
      parityOverrides: {},
    },
    subjects: [TSS, ALG, OFF],
    patterns: [p1, p2],
    overrides: [],
    exams: [],
    homework: [],
    notes: [],
    links: [],
    ...over,
  };
}

const empty = (): PlannerData => ({
  semester: null,
  subjects: [],
  patterns: [],
  overrides: [],
  exams: [],
  homework: [],
  notes: [],
  links: [],
});

const TODAY = '2026-11-02';

describe('todayAgenda', () => {
  it('finds the current session and free-after time', () => {
    const r = todayAgenda(make(), TODAY, 625);
    expect(r.sessions.map((s) => s.id)).toEqual(['p1:2026-11-02', 'p2:2026-11-02']);
    expect(r.currentSessionId).toBe('p1:2026-11-02');
    expect(r.freeAfter).toBe('12:50');
    expect(r.setupNeeded).toBe(false);
    expect(r.week?.number).toBe(6);
  });

  it('uses start <= now < end', () => {
    expect(todayAgenda(make(), TODAY, 580).currentSessionId).toBe('p1:2026-11-02'); // 09:40
    expect(todayAgenda(make(), TODAY, 670).currentSessionId).toBeNull(); // 11:10 = end
    expect(todayAgenda(make(), TODAY, 680).currentSessionId).toBe('p2:2026-11-02'); // 11:20
    expect(todayAgenda(make(), TODAY, 570).currentSessionId).toBeNull();
  });

  it('freeAfter is null with no sessions that day', () => {
    const r = todayAgenda(make(), '2026-11-03', 600);
    expect(r.sessions).toEqual([]);
    expect(r.freeAfter).toBeNull();
    expect(r.currentSessionId).toBeNull();
    expect(r.setupNeeded).toBe(false);
  });

  it('setupNeeded when empty data', () => {
    const r = todayAgenda(empty(), TODAY, 600);
    expect(r.setupNeeded).toBe(true);
    expect(r.week).toBeNull();
    expect(r.sessions).toEqual([]);
  });

  it('setupNeeded when only deleted patterns, or no semester', () => {
    const d = make({ patterns: [{ ...p1, deleted: true }] });
    expect(todayAgenda(d, TODAY, 600).setupNeeded).toBe(true);
    expect(todayAgenda(make({ semester: null }), TODAY, 600).setupNeeded).toBe(true);
  });

  it('break week returns no sessions and isBreak', () => {
    const r = todayAgenda(make(), '2026-12-21', 600);
    expect(r.sessions).toEqual([]);
    expect(r.week?.isBreak).toBe(true);
    expect(r.setupNeeded).toBe(false);
  });
});

describe('nextExam', () => {
  const ex = (over: Partial<Exam>): Exam => ({
    id: 'e',
    updatedAt: 0,
    subjectId: 'tss',
    title: 'Exam',
    date: '2026-11-12',
    start: '10:00',
    room: 'A',
    ...over,
  });

  it('returns daysAway for a future exam', () => {
    const r = nextExam(make({ exams: [ex({})] }), TODAY);
    expect(r?.daysAway).toBe(10);
  });

  it('null when none; ignores past and deleted', () => {
    expect(nextExam(make(), TODAY)).toBeNull();
    const d = make({
      exams: [
        ex({ id: 'a', date: '2026-11-01' }),
        ex({ id: 'b', date: '2026-11-05', deleted: true }),
      ],
    });
    expect(nextExam(d, TODAY)).toBeNull();
  });

  it('an exam today counts with daysAway 0', () => {
    const r = nextExam(make({ exams: [ex({ date: TODAY })] }), TODAY);
    expect(r?.daysAway).toBe(0);
  });

  it('earliest date wins, then earliest start with null first', () => {
    const d = make({
      exams: [
        ex({ id: 'late', date: '2026-11-20' }),
        ex({ id: 'b', date: '2026-11-10', start: '12:00' }),
        ex({ id: 'a', date: '2026-11-10', start: '09:00' }),
      ],
    });
    expect(nextExam(d, TODAY)?.exam.id).toBe('a');
    const d2 = make({
      exams: [
        ex({ id: 'a', date: '2026-11-10', start: '09:00' }),
        ex({ id: 'n', date: '2026-11-10', start: null }),
      ],
    });
    expect(nextExam(d2, TODAY)?.exam.id).toBe('n');
  });
});

describe('homeworkGroups', () => {
  const hw = (over: Partial<Homework>): Homework => ({
    id: 'h',
    updatedAt: 0,
    title: 'T',
    subjectId: 'tss',
    due: '2026-11-03',
    dueTime: null,
    done: false,
    ...over,
  });

  it('splits this week (incl. overdue) from later', () => {
    const d = make({
      homework: [
        hw({ id: 'a', due: '2026-11-03' }),
        hw({ id: 'b', due: '2026-11-01' }),
        hw({ id: 'c', due: '2026-11-16' }),
        hw({ id: 'sun', due: '2026-11-08' }),
        hw({ id: 'mon', due: '2026-11-09' }),
      ],
    });
    const r = homeworkGroups(d, TODAY);
    expect(r.thisWeek.map((h) => h.id)).toEqual(['b', 'a', 'sun']);
    expect(r.later.map((h) => h.id)).toEqual(['mon', 'c']);
    expect(r.done).toEqual([]);
  });

  it('done items go only in done, sorted by due descending', () => {
    const d = make({
      homework: [
        hw({ id: 'd1', done: true, due: '2026-11-03' }),
        hw({ id: 'd2', done: true, due: '2026-12-01' }),
        hw({ id: 'd3', done: true, due: '2026-10-01' }),
      ],
    });
    const r = homeworkGroups(d, TODAY);
    expect(r.done.map((h) => h.id)).toEqual(['d2', 'd1', 'd3']);
    expect(r.thisWeek).toEqual([]);
    expect(r.later).toEqual([]);
  });

  it('sorts by due, then dueTime (null last), then title; skips deleted', () => {
    const d = make({
      homework: [
        hw({ id: 'x', due: '2026-11-04', dueTime: null, title: 'A' }),
        hw({ id: 'y', due: '2026-11-04', dueTime: '09:00', title: 'Z' }),
        hw({ id: 'z', due: '2026-11-04', dueTime: '09:00', title: 'B' }),
        hw({ id: 'del', due: '2026-11-04', deleted: true }),
      ],
    });
    expect(homeworkGroups(d, TODAY).thisWeek.map((h) => h.id)).toEqual(['z', 'y', 'x']);
  });

  it('keeps homework of switched-off subjects', () => {
    const d = make({ homework: [hw({ id: 'off', subjectId: 'off' })] });
    expect(homeworkGroups(d, TODAY).thisWeek.map((h) => h.id)).toEqual(['off']);
  });
});

describe('notesFor', () => {
  const note = (over: Partial<Note>): Note => ({
    id: 'n',
    updatedAt: 0,
    text: 't',
    subjectId: null,
    sessionId: null,
    createdAt: 1,
    ...over,
  });

  it('subject filter includes session-only notes of that subject', () => {
    const d = make({
      notes: [
        note({ id: 'direct', subjectId: 'tss', createdAt: 1 }),
        note({ id: 'viaSession', sessionId: 'p1:2026-11-02', createdAt: 3 }),
        note({ id: 'other', subjectId: 'alg', createdAt: 2 }),
        note({ id: 'del', subjectId: 'tss', deleted: true }),
      ],
    });
    expect(notesFor(d, { subjectId: 'tss' }).map((n) => n.id)).toEqual(['viaSession', 'direct']);
  });

  it('session filter, and both filters must match', () => {
    const d = make({
      notes: [
        note({ id: 'a', sessionId: 'p1:2026-11-02', subjectId: 'tss' }),
        note({ id: 'b', sessionId: 'p1:2026-11-09' }),
      ],
    });
    expect(notesFor(d, { sessionId: 'p1:2026-11-02' }).map((n) => n.id)).toEqual(['a']);
    expect(notesFor(d, { sessionId: 'p1:2026-11-09', subjectId: 'tss' }).map((n) => n.id)).toEqual([
      'b',
    ]);
    expect(notesFor(d, { sessionId: 'p1:2026-11-09', subjectId: 'alg' })).toEqual([]);
  });

  it('keeps notes of switched-off subjects and ended patterns', () => {
    const offPat = pat({ id: 'po', subjectId: 'off', validTo: '2026-10-05' });
    const d = make({
      patterns: [p1, offPat],
      notes: [note({ id: 'o', sessionId: 'po:2026-10-05' }), note({ id: 'p', subjectId: 'off' })],
    });
    expect(
      notesFor(d, { subjectId: 'off' })
        .map((n) => n.id)
        .sort(),
    ).toEqual(['o', 'p']);
  });

  it('splits the session id on the last colon', () => {
    const d = make({
      patterns: [pat({ id: 'a:b' })],
      notes: [note({ id: 'x', sessionId: 'a:b:2026-11-02' })],
    });
    expect(notesFor(d, { subjectId: 'tss' }).map((n) => n.id)).toEqual(['x']);
  });
});

describe('linksBySubject', () => {
  const link = (over: Partial<Link>): Link => ({
    id: 'l',
    updatedAt: 0,
    title: 'L',
    url: 'https://x',
    subjectId: null,
    ...over,
  });

  it('groups general and attending subjects, sorted', () => {
    const d = make({
      links: [
        link({ id: '1', title: 'Zeta' }),
        link({ id: '2', title: 'Alpha' }),
        link({ id: '3', title: 'B', subjectId: 'tss' }),
        link({ id: '4', title: 'A', subjectId: 'tss' }),
        link({ id: '5', title: 'hidden', subjectId: 'off' }),
        link({ id: '6', title: 'del', deleted: true }),
      ],
    });
    const r = linksBySubject(d);
    expect(r.general.map((l) => l.id)).toEqual(['2', '1']);
    expect(r.bySubject.map((g) => g.subject.id)).toEqual(['alg', 'tss']);
    expect(r.bySubject[0].links).toEqual([]);
    expect(r.bySubject[1].links.map((l) => l.id)).toEqual(['4', '3']);
  });

  it('excludes deleted subjects', () => {
    const d = make({ subjects: [TSS, { ...ALG, deleted: true }] });
    expect(linksBySubject(d).bySubject.map((g) => g.subject.id)).toEqual(['tss']);
  });
});

describe('dueLabel', () => {
  it.each([
    ['2026-11-01', 'Overdue'],
    ['2026-10-01', 'Overdue'],
    ['2026-11-02', 'Today'],
    ['2026-11-03', 'Tomorrow'],
    ['2026-11-05', 'Thu 5'],
    ['2026-11-08', 'Sun 8'],
    ['2026-11-09', '9 Nov'],
    ['2026-11-16', '16 Nov'],
    ['2027-01-03', '3 Jan'],
  ])('%s -> %s', (due, label) => {
    expect(dueLabel(due, TODAY)).toBe(label);
  });
});
