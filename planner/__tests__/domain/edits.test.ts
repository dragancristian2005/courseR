import { cancelThisWeek, changeEveryWeek, moveThisWeek } from '../../src/domain/edits';
import { sessionsBetween, sessionById } from '../../src/domain/sessions';
import type { ClassPattern, PlannerData, Subject } from '../../src/domain/types';

const subject: Subject = { id: 'sub1', updatedAt: 0, name: 'TSS', abbreviation: 'TSS', attending: true };

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

const hasUndefined = (o: object) => Object.values(o).some((v) => v === undefined);

describe('moveThisWeek', () => {
  const session = sessionById(make(), 'p1:2026-11-02')!;

  it('returns a moved override with a deterministic id', () => {
    const r = moveThisWeek(session, { date: '2026-11-03', start: '13:00', end: '14:30' }, 50);
    expect(r).toEqual({
      id: 'ov_p1_2026-11-02',
      sessionId: 'p1:2026-11-02',
      kind: 'moved',
      date: '2026-11-03',
      start: '13:00',
      end: '14:30',
      updatedAt: 50,
    });
    expect('room' in r).toBe(false);
  });

  it('includes room only when given', () => {
    const r = moveThisWeek(session, { date: '2026-11-03', start: '13:00', end: '14:30', room: '101' }, 50);
    expect(r.room).toBe('101');
  });

  it('re-moving overwrites the same record id', () => {
    const a = moveThisWeek(session, { date: '2026-11-03', start: '13:00', end: '14:30' }, 1);
    const b = moveThisWeek(session, { date: '2026-11-04', start: '09:00', end: '10:30' }, 2);
    expect(a.id).toBe(b.id);
  });

  it('is applied by sessionsBetween', () => {
    const o = moveThisWeek(session, { date: '2026-11-03', start: '13:00', end: '14:30' }, 50);
    const r = sessionsBetween(make({ overrides: [o] }), '2026-11-03', '2026-11-03');
    expect(r[0]).toMatchObject({ id: 'p1:2026-11-02', start: '13:00', moved: true });
  });
});

describe('cancelThisWeek', () => {
  const session = sessionById(make(), 'p1:2026-11-02')!;

  it('returns a cancelled override', () => {
    expect(cancelThisWeek(session, 7)).toEqual({
      id: 'ov_p1_2026-11-02',
      sessionId: 'p1:2026-11-02',
      kind: 'cancelled',
      updatedAt: 7,
    });
  });

  it('cancel after move overwrites the same id and wins', () => {
    const m = moveThisWeek(session, { date: '2026-11-03', start: '13:00', end: '14:30' }, 1);
    const c = cancelThisWeek(session, 2);
    expect(c.id).toBe(m.id);
    expect(sessionsBetween(make({ overrides: [c] }), '2026-11-02', '2026-11-08')).toEqual([]);
  });
});

describe('changeEveryWeek', () => {
  const changes = { start: '13:00', end: '14:30' };

  it('ends the old pattern and creates a new one', () => {
    const { ended, created } = changeEveryWeek(p1, '2026-11-09', changes, 99, () => 'new1');
    expect(ended.validTo).toBe('2026-11-08');
    expect(ended.updatedAt).toBe(99);
    expect(ended.id).toBe('p1');
    expect(ended.deleted).toBeUndefined();
    expect(created).toMatchObject({
      id: 'new1',
      validFrom: '2026-11-09',
      validTo: null,
      start: '13:00',
      end: '14:30',
      room: '048',
      updatedAt: 99,
    });
    expect(hasUndefined(ended)).toBe(false);
    expect(hasUndefined(created)).toBe(false);
    expect(created.deleted).toBeUndefined();
  });

  it('does not rewrite earlier weeks', () => {
    const { ended, created } = changeEveryWeek(p1, '2026-11-09', changes, 99, () => 'new1');
    const d = make({ patterns: [ended, created] });
    const w6 = sessionsBetween(d, '2026-11-02', '2026-11-08');
    expect(w6).toHaveLength(1);
    expect(w6[0]).toMatchObject({ id: 'p1:2026-11-02', start: '11:20' });
    const w7 = sessionsBetween(d, '2026-11-09', '2026-11-15');
    expect(w7).toHaveLength(1);
    expect(w7[0]).toMatchObject({ id: 'new1:2026-11-09', start: '13:00' });
  });

  it('keeps the old validTo on the created pattern', () => {
    const { created } = changeEveryWeek({ ...p1, validTo: '2026-12-13' }, '2026-11-09', changes, 1, () => 'n');
    expect(created.validTo).toBe('2026-12-13');
  });

  it('tombstones ended when from equals validFrom', () => {
    const { ended, created } = changeEveryWeek(p1, '2026-09-28', changes, 5, () => 'n');
    expect(ended.deleted).toBe(true);
    expect(created.validFrom).toBe('2026-09-28');
    const d = make({ patterns: [ended, created] });
    expect(sessionsBetween(d, '2026-09-28', '2026-10-04')[0]).toMatchObject({ id: 'n:2026-09-28', start: '13:00' });
  });

  it('treats from before validFrom as validFrom', () => {
    const { ended, created } = changeEveryWeek(p1, '2026-09-01', changes, 5, () => 'n');
    expect(ended.deleted).toBe(true);
    expect(created.validFrom).toBe('2026-09-28');
  });

  it('throws when from is after validTo', () => {
    expect(() =>
      changeEveryWeek({ ...p1, validTo: '2026-10-31' }, '2026-11-09', changes, 1, () => 'n'),
    ).toThrow('Cannot change a class after it has ended.');
  });

  it('allows from equal to validTo', () => {
    const { ended } = changeEveryWeek({ ...p1, validTo: '2026-11-09' }, '2026-11-09', changes, 1, () => 'n');
    expect(ended.validTo).toBe('2026-11-08');
  });

  it('does not let changes clobber id, validity or timestamps with undefined', () => {
    const { created } = changeEveryWeek(p1, '2026-11-09', { room: undefined }, 1, () => 'n');
    expect(hasUndefined(created)).toBe(false);
    expect(created.room).toBe('048');
  });
});
