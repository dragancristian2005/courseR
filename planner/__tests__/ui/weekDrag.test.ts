import { ROW_HEIGHT, slotRowOf, snapDrop } from '../../src/ui/weekDrag';

const monday = '2026-11-02';
const mon = { date: '2026-11-02', start: '09:40', end: '11:10' };
const at = (dx: number, dy: number, session = mon, dayCount = 5) =>
  snapDrop({ session, monday, dayCount, columnWidth: 60, dx, dy });

describe('slotRowOf', () => {
  it('finds the row a time falls in', () => {
    expect(slotRowOf('08:00')).toBe(0);
    expect(slotRowOf('09:39')).toBe(0);
    expect(slotRowOf('09:40')).toBe(1);
    expect(slotRowOf('10:00')).toBe(1);
    expect(slotRowOf('07:00')).toBe(0);
    expect(slotRowOf('21:00')).toBe(7);
  });
});

describe('snapDrop', () => {
  it('moves by whole columns and rows, keeping the length', () => {
    expect(at(120, ROW_HEIGHT)).toEqual({ date: '2026-11-04', start: '11:20', end: '12:50' });
  });

  it('snaps to the nearest column and slot', () => {
    expect(at(29, 31)).toBeNull(); // under half a column and half a row: same place
    expect(at(31, 33)).toEqual({ date: '2026-11-03', start: '11:20', end: '12:50' });
    expect(at(-31, -33)).toEqual({ date: '2026-11-02', start: '08:00', end: '09:30' });
  });

  it('snaps up and left', () => {
    expect(at(0, -33)).toEqual({ date: '2026-11-02', start: '08:00', end: '09:30' });
    expect(at(61, -ROW_HEIGHT)).toEqual({ date: '2026-11-03', start: '08:00', end: '09:30' });
  });

  it('returns null for the same day and slot', () => {
    expect(at(0, 0)).toBeNull();
    expect(at(5, -5)).toBeNull();
  });

  it('treats a class with a non-standard start as being in its containing slot', () => {
    const odd = { date: '2026-11-02', start: '10:00', end: '11:30' };
    expect(at(0, 0, odd)).toBeNull();
    expect(at(0, ROW_HEIGHT, odd)).toEqual({ date: '2026-11-02', start: '11:20', end: '12:50' });
  });

  it('clamps to the shown days', () => {
    expect(at(-500, 0)).toEqual(null); // already Monday
    expect(at(-500, ROW_HEIGHT)).toEqual({ date: '2026-11-02', start: '11:20', end: '12:50' });
    expect(at(5000, 0)).toEqual({ date: '2026-11-06', start: '09:40', end: '11:10' });
    expect(at(5000, 0, mon, 6)).toEqual({ date: '2026-11-07', start: '09:40', end: '11:10' });
  });

  it('clamps to the shown slots', () => {
    expect(at(0, -5000)).toEqual({ date: '2026-11-02', start: '08:00', end: '09:30' });
    expect(at(0, 5000)).toEqual({ date: '2026-11-02', start: '19:40', end: '21:10' });
  });

  it('picks an earlier slot when the class would run past midnight', () => {
    const long = { date: '2026-11-02', start: '08:00', end: '13:00' }; // 5 hours
    expect(at(0, 5000, long)).toEqual({ date: '2026-11-02', start: '18:00', end: '23:00' });
  });

  it('stays in the same column without a measured width', () => {
    expect(snapDrop({ session: mon, monday, dayCount: 5, columnWidth: 0, dx: 300, dy: 0 })).toBe(
      null,
    );
  });
});
