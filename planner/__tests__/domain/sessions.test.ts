import { sessionById, sessionsBetween } from '../../src/domain/sessions';
import type {
  ClassPattern,
  PlannerData,
  SessionOverride,
  Subject,
} from '../../src/domain/types';

const subject: Subject = {
  id: 'sub1',
  updatedAt: 0,
  name: 'TSS',
  abbreviation: 'TSS',
  attending: true,
};

const p1: ClassPattern = {
  id: 'p1',
  updatedAt: 0,
  subjectId: 'sub1',
  type: 'seminar',
  weekday: 1,
  start: '11:20',
  end: '12:50',
  room: '048',
  teacher: 'T',
  repeat: 'every',
  validFrom: '2026-09-28',
  validTo: null,
  online: false,
};

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

describe('sessionsBetween', () => {
  it('generates a weekly session', () => {
    const r = sessionsBetween(make(), '2026-11-02', '2026-11-08');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: 'p1:2026-11-02',
      patternId: 'p1',
      date: '2026-11-02',
      start: '11:20',
      end: '12:50',
      room: '048',
      moved: false,
    });
  });

  it('respects odd parity', () => {
    const d = make({ patterns: [{ ...p1, repeat: 'odd' }] });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-08')).toHaveLength(0);
    const w7 = sessionsBetween(d, '2026-11-09', '2026-11-15');
    expect(w7).toHaveLength(1);
    expect(w7[0].id).toBe('p1:2026-11-09');
  });

  it('has nothing during a break', () => {
    expect(sessionsBetween(make(), '2026-12-21', '2026-12-27')).toEqual([]);
  });

  it('hides unattended subjects and restores same ids', () => {
    const off = make({ subjects: [{ ...subject, attending: false }] });
    expect(sessionsBetween(off, '2026-11-02', '2026-11-08')).toEqual([]);
    const on = make({ subjects: [{ ...subject, attending: true }] });
    expect(sessionsBetween(on, '2026-11-02', '2026-11-08')[0].id).toBe('p1:2026-11-02');
  });

  it('applies moved override and keeps original id', () => {
    const d = make({
      overrides: [ov({ kind: 'moved', date: '2026-11-03', start: '13:00', end: '14:30' })],
    });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-02')).toEqual([]);
    const r = sessionsBetween(d, '2026-11-03', '2026-11-03');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: 'p1:2026-11-02',
      date: '2026-11-03',
      start: '13:00',
      end: '14:30',
      room: '048',
      moved: true,
    });
  });

  it('moved override can change room', () => {
    const d = make({ overrides: [ov({ kind: 'moved', room: '101' })] });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-02')[0]).toMatchObject({
      room: '101',
      date: '2026-11-02',
      start: '11:20',
      moved: true,
    });
  });

  it('moved into range from outside appears; moved out disappears', () => {
    const d = make({ overrides: [ov({ kind: 'moved', date: '2026-11-20' })] });
    expect(sessionsBetween(d, '2026-11-16', '2026-11-22').map((s) => s.id)).toEqual([
      'p1:2026-11-16',
      'p1:2026-11-02',
    ]);
    expect(sessionsBetween(d, '2026-11-02', '2026-11-08')).toEqual([]);
  });

  it('cancelled removes the session', () => {
    const d = make({ overrides: [ov({ kind: 'cancelled' })] });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-08')).toEqual([]);
  });

  it('ignores deleted overrides', () => {
    const d = make({ overrides: [ov({ kind: 'cancelled', deleted: true })] });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-08')).toHaveLength(1);
  });

  it('latest updatedAt override wins', () => {
    const d = make({
      overrides: [
        ov({ id: 'a', updatedAt: 5, kind: 'cancelled' }),
        ov({ id: 'b', updatedAt: 9, kind: 'moved', date: '2026-11-03' }),
      ],
    });
    expect(sessionsBetween(d, '2026-11-03', '2026-11-03')).toHaveLength(1);
    expect(sessionsBetween(d, '2026-11-02', '2026-11-02')).toEqual([]);
  });

  it('respects validTo', () => {
    const d = make({ patterns: [{ ...p1, validTo: '2026-10-31' }] });
    expect(sessionsBetween(d, '2026-11-01', '2026-12-20')).toEqual([]);
    expect(sessionsBetween(d, '2026-10-26', '2026-11-01').map((s) => s.id)).toEqual([
      'p1:2026-10-26',
    ]);
  });

  it('respects validFrom and the semester bounds', () => {
    const d = make({ patterns: [{ ...p1, validFrom: '2026-10-05' }] });
    expect(sessionsBetween(d, '2026-09-28', '2026-10-04')).toEqual([]);
    const all = sessionsBetween(make(), '2026-01-01', '2027-12-31');
    expect(all[0].date).toBe('2026-09-28');
    expect(all[all.length - 1].date).toBe('2027-01-11');
  });

  it('ignores deleted patterns and patterns of missing or deleted subjects', () => {
    expect(sessionsBetween(make({ patterns: [{ ...p1, deleted: true }] }), '2026-11-02', '2026-11-08')).toEqual([]);
    expect(sessionsBetween(make({ subjects: [] }), '2026-11-02', '2026-11-08')).toEqual([]);
    expect(
      sessionsBetween(make({ subjects: [{ ...subject, deleted: true }] }), '2026-11-02', '2026-11-08'),
    ).toEqual([]);
  });

  it('returns [] without a semester', () => {
    expect(sessionsBetween(make({ semester: null }), '2026-11-02', '2026-11-08')).toEqual([]);
  });

  it('sorts by date, start, then patternId', () => {
    const d = make({
      patterns: [
        { ...p1, id: 'b', start: '09:00', end: '10:00' },
        { ...p1, id: 'a', start: '09:00', end: '10:00' },
        { ...p1, id: 'c', start: '08:00', end: '09:00' },
        { ...p1, id: 'd', weekday: 2 },
      ],
    });
    expect(sessionsBetween(d, '2026-11-02', '2026-11-08').map((s) => s.patternId)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });
});

describe('sessionById', () => {
  it('finds a plain session', () => {
    expect(sessionById(make(), 'p1:2026-11-02')).toMatchObject({ id: 'p1:2026-11-02', moved: false });
  });

  it('returns the moved session', () => {
    const d = make({
      overrides: [ov({ kind: 'moved', date: '2026-11-03', start: '13:00', end: '14:30' })],
    });
    expect(sessionById(d, 'p1:2026-11-02')).toMatchObject({
      date: '2026-11-03',
      start: '13:00',
      moved: true,
    });
  });

  it('returns null for cancelled, malformed, unknown, invalid-date, unattended', () => {
    expect(sessionById(make({ overrides: [ov({})] }), 'p1:2026-11-02')).toBeNull();
    expect(sessionById(make(), 'garbage')).toBeNull();
    expect(sessionById(make(), ':2026-11-02')).toBeNull();
    expect(sessionById(make(), 'p1:')).toBeNull();
    expect(sessionById(make(), 'nope:2026-11-02')).toBeNull();
    expect(sessionById(make(), 'p1:2026-11-03')).toBeNull(); // not a Monday
    expect(sessionById(make(), 'p1:2026-12-21')).toBeNull(); // break
    expect(sessionById(make(), 'p1:2026-02-30')).toBeNull();
    expect(
      sessionById(make({ subjects: [{ ...subject, attending: false }] }), 'p1:2026-11-02'),
    ).toBeNull();
    expect(sessionById(make({ patterns: [{ ...p1, deleted: true }] }), 'p1:2026-11-02')).toBeNull();
    expect(sessionById(make({ semester: null }), 'p1:2026-11-02')).toBeNull();
  });
});
