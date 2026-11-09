import { theme } from '../../src/ui/theme';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Week from '../../app/(tabs)/week';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { ClassPattern, PlannerData, Semester, Subject } from '../../src/domain/types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockLayout = 'phone';
jest.mock('../../src/ui/useLayout', () => ({ useLayout: () => mockLayout }));

const semester: Semester = {
  id: 'sem',
  updatedAt: 1,
  name: 'Autumn',
  firstDay: '2026-09-28',
  lastDay: '2027-01-17',
  breaks: [{ from: '2026-11-09', to: '2026-11-15' }],
  parityOverrides: {},
};
const tss: Subject = {
  id: 'tss',
  updatedAt: 1,
  name: 'Teoria Sistemelor',
  abbreviation: 'TSS',
  attending: true,
};
const alg: Subject = {
  id: 'alg',
  updatedAt: 1,
  name: 'Algebră',
  abbreviation: 'ALG',
  attending: true,
};
const pat = (over: Partial<ClassPattern>): ClassPattern => ({
  id: 'p1',
  updatedAt: 1,
  subjectId: 'tss',
  type: 'course',
  weekday: 1,
  start: '10:00',
  end: '11:30',
  room: '048',
  teacher: 'Mutescul A.',
  repeat: 'every',
  validFrom: '2026-09-28',
  validTo: null,
  online: false,
  ...over,
});
const p1 = pat({});
const p2 = pat({
  id: 'p2',
  subjectId: 'alg',
  type: 'seminar',
  weekday: 3,
  start: '14:40',
  end: '16:10',
  room: '12',
  teacher: 'Popa I.',
});
const base: Partial<PlannerData> = {
  semester,
  subjects: [tss, alg],
  patterns: [p1, p2],
};

async function setup(initial: Partial<PlannerData> = base) {
  const repo = createMemoryRepository(initial);
  await render(
    <StoreProvider repository={repo}>
      <Week />
    </StoreProvider>,
  );
  return { repo };
}

const movedIntoBreak = {
  id: 'ov_p1_2026-11-02',
  updatedAt: 5,
  sessionId: 'p1:2026-11-02',
  kind: 'moved' as const,
  date: '2026-11-10',
  start: '12:00',
  end: '13:30',
  room: '7',
};
const cancelledOv = {
  id: 'ov_p1_2026-11-02',
  updatedAt: 5,
  sessionId: 'p1:2026-11-02',
  kind: 'cancelled' as const,
};

beforeEach(() => {
  mockLayout = 'phone';
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('Week screen', () => {
  it('shows the week header', async () => {
    await setup();
    expect(screen.getByText('Week 6')).toBeTruthy();
    expect(screen.getByText('2 to 6 November, even week')).toBeTruthy();
  });

  it('highlights only today in the day header', async () => {
    await setup();
    expect(screen.getByText('Mon 2')).toBeTruthy();
    expect(screen.getByText('Fri 6')).toBeTruthy();
    expect(screen.getAllByTestId('today-header')).toHaveLength(1);
    expect(screen.getAllByTestId('week-now-line')).toHaveLength(1);
  });

  it('moves between weeks and back, without today highlight elsewhere', async () => {
    await setup();
    expect(screen.queryByText('This week')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByText('Week 5')).toBeTruthy();
    expect(screen.getByText('26 to 30 October, odd week')).toBeTruthy();
    expect(screen.queryAllByTestId('today-header')).toHaveLength(0);
    expect(screen.queryAllByTestId('week-now-line')).toHaveLength(0);
    await fireEvent.press(screen.getByText('This week'));
    expect(screen.getByText('Week 6')).toBeTruthy();
    expect(screen.queryByText('This week')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Break')).toBeTruthy();
    expect(screen.getByText('9 to 13 November, break')).toBeTruthy();
    expect(screen.getByText('No classes this week, it’s a break.')).toBeTruthy();
    expect(screen.queryByText('Mon 9')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Week 7')).toBeTruthy();
  });

  it('formats a range crossing months', async () => {
    jest.setSystemTime(new Date(2026, 10, 30, 10, 25));
    await setup();
    expect(screen.getByText('30 November to 4 December, odd week')).toBeTruthy();
  });

  it('says outside the semester', async () => {
    jest.setSystemTime(new Date(2027, 2, 3, 10, 25));
    await setup();
    expect(screen.getByText('Week')).toBeTruthy();
    expect(screen.getByText('1 to 5 March, outside the semester')).toBeTruthy();
  });

  it('places a class with a non-standard start in the containing row', async () => {
    await setup();
    const cell = screen.getByRole('button', {
      name: 'Teoria Sistemelor, course, Mon 10:00 to 11:30, room 048',
    });
    expect(cell).toBeTruthy();
    expect(screen.getByTestId('cell-p1:2026-11-02').props.style).toEqual(
      expect.objectContaining({ top: 64, height: 128 }),
    );
  });

  it('navigates to the class on phone', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: /Teoria Sistemelor, course/ }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/class/[sessionId]',
      params: { sessionId: 'p1:2026-11-02' },
    });
  });

  it('shows abbreviation and room in compact cells', async () => {
    await setup();
    expect(screen.getByText('TSS')).toBeTruthy();
    expect(screen.getByText('048')).toBeTruthy();
    expect(screen.queryByText('Teoria Sistemelor')).toBeNull();
  });

  it('adds weekend columns only when needed', async () => {
    await setup();
    expect(screen.queryByText('Sat 7')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.queryByText('Sat 31')).toBeNull();
  });

  it('shows Saturday when it has a class', async () => {
    await setup({ ...base, patterns: [p1, pat({ id: 'p3', weekday: 6 })] });
    expect(screen.getByText('Sat 7')).toBeTruthy();
    expect(screen.queryByText('Sun 8')).toBeNull();
    expect(screen.getByText('2 to 7 November, even week')).toBeTruthy();
  });

  it('spans a long class over two rows and starts rows at the right place', async () => {
    await setup({ ...base, patterns: [pat({ start: '08:00', end: '11:00' })] });
    expect(screen.getByTestId('cell-p1:2026-11-02').props.style).toEqual(
      expect.objectContaining({ top: 0, height: 128 }),
    );
  });

  it('renders overlapping classes side by side', async () => {
    await setup({
      ...base,
      patterns: [
        p1,
        pat({
          id: 'p4',
          subjectId: 'alg',
          start: '10:30',
          end: '12:00',
          room: '9',
        }),
      ],
    });
    const a = screen.getByTestId('cell-p1:2026-11-02').props.style;
    const b = screen.getByTestId('cell-p4:2026-11-02').props.style;
    expect(a.left).toBe('0%');
    expect(b.left).toBe('50%');
    expect(a.width).toBe('50%');
  });

  it('hides subjects that are switched off', async () => {
    await setup({ ...base, subjects: [tss, { ...alg, attending: false }] });
    expect(screen.getByText('TSS')).toBeTruthy();
    expect(screen.queryByText('ALG')).toBeNull();
  });

  it('shows the subject when it is switched on (control)', async () => {
    await setup();
    expect(
      screen.getByRole('button', {
        name: /Algebră, seminar, Wed 14:40 to 16:10/,
      }),
    ).toBeTruthy();
    expect(screen.getByText('ALG')).toBeTruthy();
  });

  it('prompts when there is no semester', async () => {
    await setup({});
    expect(screen.getByText('Set up your semester')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next week' })).toBeNull();
    expect(screen.queryByText('Week')).toBeNull();
    await fireEvent.press(screen.getByText('Set up semester'));
    expect(router.push).toHaveBeenCalledWith('/settings/semester');
  });

  it('shows a legend', async () => {
    await setup();
    expect(screen.getByText('Course')).toBeTruthy();
    expect(screen.getByText('Seminar')).toBeTruthy();
    expect(screen.getByText('Lab')).toBeTruthy();
  });

  it('keeps the now line out of range hours', async () => {
    jest.setSystemTime(new Date(2026, 10, 2, 23, 0));
    await setup();
    expect(screen.queryAllByTestId('week-now-line')).toHaveLength(0);
  });

  it('moves the now line as time passes', async () => {
    await setup();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getAllByTestId('week-now-line')).toHaveLength(1);
  });

  describe('wide layout', () => {
    beforeEach(() => {
      mockLayout = 'wide';
    });

    it('asks to select a class, then shows details instead of navigating', async () => {
      await setup();
      expect(screen.getByText('Select a class to see its details.')).toBeTruthy();
      expect(screen.getByText('Teoria Sistemelor')).toBeTruthy(); // full density in the cell
      await fireEvent.press(screen.getByRole('button', { name: /Teoria Sistemelor, course/ }));
      expect(router.push).not.toHaveBeenCalled();
      expect(screen.queryByText('Select a class to see its details.')).toBeNull();
      expect(screen.getByText('Course, Monday 2 November')).toBeTruthy();
      expect(screen.getByText('10:00 to 11:30')).toBeTruthy();
      expect(screen.getByText('Mutescul A.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Move this week' })).toBeTruthy();
    });

    it('does not carry an open form over to another selected class', async () => {
      await setup();
      await fireEvent.press(screen.getByRole('button', { name: /Teoria Sistemelor, course/ }));
      await fireEvent.press(screen.getByRole('button', { name: 'Move this week' }));
      expect(screen.getByRole('button', { name: 'Save move' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: /Algebră, seminar/ }));
      expect(screen.queryByRole('button', { name: 'Save move' })).toBeNull();
      expect(screen.getByText('14:40 to 16:10')).toBeTruthy();
    });
  });

  it('marks a moved class and labels it for screen readers', async () => {
    await setup({
      ...base,
      overrides: [{ ...movedIntoBreak, date: '2026-11-04' }],
    });
    expect(screen.getByText('Moved')).toBeTruthy();
    expect(screen.getByTestId('cell-p1:2026-11-02')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Teoria Sistemelor.*Wed 12:00 to 13:30.*moved/ }),
    ).toBeTruthy();
  });

  it('shows a cancelled class struck through and muted', async () => {
    await setup({ ...base, overrides: [cancelledOv] });
    const cell = screen.getByRole('button', {
      name: /Teoria Sistemelor.*Mon 10:00 to 11:30.*cancelled/,
    });
    expect(cell).toBeTruthy();
    const name = screen.getByText('TSS');
    expect(StyleSheet.flatten(name.props.style).textDecorationLine).toBe('line-through');
    const cellStyle = StyleSheet.flatten(cell.props.style);
    expect(cellStyle.opacity ?? 1).toBe(1);
    expect(cellStyle.borderStyle).toBe('dashed');
    expect(cellStyle.borderColor).not.toBe(theme.color.paper);
    expect(screen.queryByText('Moved')).toBeNull();
    await fireEvent.press(cell);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/class/[sessionId]',
      params: { sessionId: 'p1:2026-11-02' },
    });
  });

  it('shows a class moved into a break week on the break week', async () => {
    await setup({ ...base, overrides: [movedIntoBreak] });
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Break')).toBeTruthy();
    expect(screen.getByText('9 to 13 November, break')).toBeTruthy();
    expect(screen.getByTestId('cell-p1:2026-11-02')).toBeTruthy();
    expect(screen.getByText('Moved')).toBeTruthy();
    expect(screen.queryByText('No classes this week, it’s a break.')).toBeNull();
  });

  it('still says break for a break week with nothing moved in', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('No classes this week, it’s a break.')).toBeTruthy();
  });
});
