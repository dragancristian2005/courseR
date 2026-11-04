import { dayRange, daysCount, longDate, shortDate, STANDARD_SLOTS } from '../../src/ui/format';

describe('format', () => {
  it('formats dates', () => {
    expect(shortDate('2026-11-02')).toBe('Mon 2 Nov');
    expect(longDate('2026-11-02')).toBe('Monday 2 November');
    expect(dayRange('2026-11-02', '2026-11-06')).toBe('2 – 6 Nov');
    expect(dayRange('2026-11-30', '2026-12-04')).toBe('30 Nov – 4 Dec');
  });

  it('counts days', () => {
    expect(daysCount(0)).toBe('Today');
    expect(daysCount(1)).toBe('1 day');
    expect(daysCount(5)).toBe('5 days');
  });

  it('lists the standard slot starts', () => {
    expect(STANDARD_SLOTS[0]).toBe('08:00');
    expect(STANDARD_SLOTS).toHaveLength(8);
  });
});
