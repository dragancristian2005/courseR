import { buildWeeks, weekFor } from '../../src/domain/weeks';
import type { Semester } from '../../src/domain/types';

const s: Semester = {
  id: 's1',
  updatedAt: 0,
  name: 'Fall',
  firstDay: '2026-09-28',
  lastDay: '2027-01-15',
  breaks: [{ from: '2026-12-21', to: '2027-01-03' }],
  parityOverrides: {},
} as Semester;

const find = (sem: Semester, monday: string) => buildWeeks(sem).find((w) => w.monday === monday)!;

describe('buildWeeks', () => {
  it('builds one entry per calendar week', () => {
    expect(buildWeeks(s).length).toBe(16);
  });

  it('numbers teaching weeks with alternating parity', () => {
    const w = find(s, '2026-11-02');
    expect(w.number).toBe(6);
    expect(w.parity).toBe('even');
    expect(find(s, '2026-09-28')).toMatchObject({ number: 1, parity: 'odd' });
  });

  it('marks break weeks without number or parity', () => {
    for (const m of ['2026-12-21', '2026-12-28']) {
      expect(find(s, m)).toMatchObject({ isBreak: true, number: null, parity: null });
    }
  });

  it('does not count break weeks', () => {
    expect(find(s, '2026-12-14')).toMatchObject({ number: 12, parity: 'even' });
    expect(find(s, '2027-01-04')).toMatchObject({ number: 13, parity: 'odd' });
  });

  it('override affects only that week', () => {
    const o = { ...s, parityOverrides: { 6: 'odd' as const } };
    expect(find(o, '2026-11-02').parity).toBe('odd');
    expect(find(o, '2026-11-09')).toMatchObject({ number: 7, parity: 'odd' });
  });
});

describe('weekFor', () => {
  it('finds the week containing a date', () => {
    expect(weekFor(s, '2026-11-05')!.number).toBe(6);
  });
  it('returns null outside the semester', () => {
    expect(weekFor(s, '2027-02-01')).toBeNull();
  });
});
