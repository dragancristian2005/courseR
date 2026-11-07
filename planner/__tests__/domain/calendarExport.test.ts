import { calendarEvents, exportCalendar } from '../../src/domain/calendarExport';
import type {
  ClassPattern,
  Exam,
  PlannerData,
  SessionOverride,
  Subject,
} from '../../src/domain/types';

const subject: Subject = {
  id: 'sub1',
  updatedAt: 0,
  name: 'Testarea sistemelor software',
  abbreviation: 'TSS',
  attending: true,
};

const p1: ClassPattern = {
  id: 'p1',
  updatedAt: 0,
  subjectId: 'sub1',
  type: 'seminar',
  weekday: 1,
  start: '08:00',
  end: '09:30',
  room: '048',
  teacher: 'Pop, Ion',
  repeat: 'every',
  validFrom: '2026-09-28',
  validTo: null,
  online: false,
};

const exam = (o: Partial<Exam>): Exam => ({
  id: 'e1',
  updatedAt: 0,
  subjectId: 'sub1',
  title: 'Final',
  date: '2026-12-10',
  start: null,
  room: '',
  ...o,
});

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
    subjects: [subject],
    patterns: [p1],
    overrides: [],
    exams: [],
    homework: [],
    notes: [],
    links: [],
    ...over,
  };
}

const ov = (o: Partial<SessionOverride>): SessionOverride => ({
  id: 'o1',
  updatedAt: 1,
  sessionId: 'p1:2026-11-02',
  kind: 'cancelled',
  ...o,
});

const both = { classes: true, exams: true };
const dates = (es: { date: string }[]) => es.map((e) => e.date);

describe('calendarEvents classes', () => {
  it('builds summary, location, description, uid', () => {
    const [e] = calendarEvents(make(), '2026-11-02', both);
    expect(e).toEqual({
      kind: 'timed',
      uid: 'p1-2026-11-02@study-planner',
      summary: 'Testarea sistemelor software (seminar)',
      location: '048',
      description: 'Teacher: Pop, Ion',
      date: '2026-11-02',
      start: '08:00',
      end: '09:30',
    });
  });

  it('uses Online and omits missing teacher', () => {
    const d = make({ patterns: [{ ...p1, online: true, room: '', teacher: '' }] });
    const [e] = calendarEvents(d, '2026-11-02', both);
    expect(e.location).toBe('Online');
    expect(e.description).toBeUndefined();
  });

  it('runs to the last day of the semester', () => {
    const es = calendarEvents(make(), '2026-11-02', both);
    expect(es[es.length - 1].date).toBe('2027-01-11');
  });

  it('odd-weeks class only in odd weeks', () => {
    const d = make({ patterns: [{ ...p1, repeat: 'odd' }] });
    expect(dates(calendarEvents(d, '2026-09-28', both)).slice(0, 3)).toEqual([
      '2026-09-28',
      '2026-10-12',
      '2026-10-26',
    ]);
  });

  it('break week has no classes', () => {
    const es = calendarEvents(make(), '2026-12-14', both);
    expect(dates(es).slice(0, 2)).toEqual(['2026-12-14', '2027-01-04']);
  });

  it('moved session at new time with Moved this week', () => {
    const d = make({
      overrides: [ov({ kind: 'moved', date: '2026-11-03', start: '10:00', end: '11:30' })],
    });
    const es = calendarEvents(d, '2026-11-02', both);
    const e = es.find((x) => x.uid === 'p1-2026-11-02@study-planner')!;
    expect(e).toMatchObject({ date: '2026-11-03', start: '10:00', end: '11:30' });
    expect(e.description).toBe('Teacher: Pop, Ion\nMoved this week');
  });

  it('moved session without teacher has only the moved line', () => {
    const d = make({
      patterns: [{ ...p1, teacher: '' }],
      overrides: [ov({ kind: 'moved', date: '2026-11-03' })],
    });
    const e = calendarEvents(d, '2026-11-02', both)[0];
    expect(e.description).toBe('Moved this week');
  });

  it('cancelled session is absent', () => {
    const es = calendarEvents(make({ overrides: [ov({})] }), '2026-11-02', both);
    expect(dates(es)).not.toContain('2026-11-02');
    expect(dates(es)[0]).toBe('2026-11-09');
  });

  it('switched-off subject is absent', () => {
    const d = make({ subjects: [{ ...subject, attending: false }] });
    expect(calendarEvents(d, '2026-11-02', both)).toEqual([]);
  });

  it('no semester gives no classes', () => {
    expect(calendarEvents(make({ semester: null }), '2026-11-02', both)).toEqual([]);
  });
});

describe('calendarEvents exams', () => {
  it('all-day exam without start', () => {
    const [e] = calendarEvents(make({ exams: [exam({ room: 'A1' })] }), '2026-12-07', {
      classes: false,
      exams: true,
    });
    expect(e).toEqual({
      kind: 'allDay',
      uid: 'exam-e1@study-planner',
      summary: 'Testarea sistemelor software: Final',
      location: 'A1',
      date: '2026-12-10',
    });
  });

  it('timed exam lasts 2 hours', () => {
    const [e] = calendarEvents(make({ exams: [exam({ start: '09:00' })] }), '2026-12-07', {
      classes: false,
      exams: true,
    });
    expect(e).toMatchObject({ kind: 'timed', start: '09:00', end: '11:00' });
    expect(e.location).toBeUndefined();
  });

  it('caps the end at 23:59', () => {
    const [e] = calendarEvents(make({ exams: [exam({ start: '23:00' })] }), '2026-12-07', {
      classes: false,
      exams: true,
    });
    expect(e).toMatchObject({ start: '23:00', end: '23:59' });
  });

  it('unlinked or deleted subject uses title only', () => {
    const d = make({
      subjects: [{ ...subject, deleted: true }],
      exams: [exam({}), exam({ id: 'e2', subjectId: null, title: 'Quiz' })],
    });
    const es = calendarEvents(d, '2026-12-07', { classes: false, exams: true });
    expect(es.map((e) => e.summary)).toEqual(['Final', 'Quiz']);
  });

  it('tombstoned and past exams are absent; from day is included', () => {
    const d = make({
      exams: [
        exam({ id: 'a', deleted: true }),
        exam({ id: 'b', date: '2026-12-06' }),
        exam({ id: 'c', date: '2026-12-07' }),
      ],
    });
    const es = calendarEvents(d, '2026-12-07', { classes: false, exams: true });
    expect(es.map((e) => e.uid)).toEqual(['exam-c@study-planner']);
  });

  it('exams still exported without semester', () => {
    const d = make({ semester: null, exams: [exam({})] });
    expect(calendarEvents(d, '2026-11-02', both)).toHaveLength(1);
  });
});

describe('options and ordering', () => {
  it('classes only / exams only', () => {
    const d = make({ exams: [exam({})] });
    const c = calendarEvents(d, '2026-12-07', { classes: true, exams: false });
    expect(c.every((e) => e.uid.startsWith('p1-'))).toBe(true);
    expect(c.length).toBeGreaterThan(0);
    const x = calendarEvents(d, '2026-12-07', { classes: false, exams: true });
    expect(x.map((e) => e.uid)).toEqual(['exam-e1@study-planner']);
    expect(calendarEvents(d, '2026-12-07', { classes: false, exams: false })).toEqual([]);
  });

  it('sorted by date then start, all-day first', () => {
    const d = make({
      exams: [
        exam({ id: 'x1', date: '2026-12-07', start: '07:00' }),
        exam({ id: 'x2', date: '2026-12-07' }),
      ],
    });
    const es = calendarEvents(d, '2026-12-07', both);
    expect(es.slice(0, 3).map((e) => e.uid)).toEqual([
      'exam-x2@study-planner',
      'exam-x1@study-planner',
      'p1-2026-12-07@study-planner',
    ]);
  });
});

describe('exportCalendar', () => {
  it('count equals events and ics has the 08:00 local time', () => {
    const d = make({ exams: [exam({})] });
    const now = new Date('2026-11-07T10:00:00Z');
    const { ics, count } = exportCalendar(d, '2026-10-26', both, now);
    expect(count).toBe(calendarEvents(d, '2026-10-26', both).length);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(count);
    expect(ics).toContain('DTSTART;TZID=Europe/Bucharest:20261026T080000\r\n');
    expect(ics).toContain('X-WR-CALNAME:Study Planner');
    expect(ics).toContain('DESCRIPTION:Teacher: Pop\\, Ion');
  });
});
