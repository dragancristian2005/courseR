import {
  addDays,
  compareDates,
  daysBetween,
  mondayOf,
  timeToMinutes,
  todayISO,
  weekdayOf,
} from '../../src/domain/dates';

describe('dates', () => {
  it('addDays crosses the 25 Oct clock change', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
  it('addDays crosses year end and goes backwards', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-02', -2)).toBe('2026-10-31');
  });
  it('weekdayOf is Monday=1 .. Sunday=7', () => {
    expect(weekdayOf('2026-11-02')).toBe(1);
    expect(weekdayOf('2026-11-08')).toBe(7);
  });
  it('mondayOf', () => {
    expect(mondayOf('2026-11-05')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-11-02', '2026-11-12')).toBe(10);
    expect(daysBetween('2026-11-12', '2026-11-02')).toBe(-10);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('compareDates', () => {
    expect(compareDates('2026-11-02', '2026-11-03')).toBeLessThan(0);
    expect(compareDates('2026-11-03', '2026-11-02')).toBeGreaterThan(0);
    expect(compareDates('2026-11-02', '2026-11-02')).toBe(0);
  });
  it('timeToMinutes', () => {
    expect(timeToMinutes('09:40')).toBe(580);
    expect(timeToMinutes('00:00')).toBe(0);
  });
  it('todayISO uses local calendar fields', () => {
    expect(todayISO(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(todayISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
