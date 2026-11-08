import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Today from '../../app/(tabs)/index';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { ClassPattern, PlannerData, Semester, Subject } from '../../src/domain/types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../src/ui/useLayout', () => ({ useLayout: () => 'phone' }));

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
  const upsert = jest.spyOn(repo, 'upsert');
  await render(
    <StoreProvider repository={repo}>
      <Today />
    </StoreProvider>,
  );
  return { repo, upsert };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('Today screen', () => {
  it('shows the date and week header', async () => {
    await setup();
    expect(screen.getByText('Monday 2 November')).toBeTruthy();
    expect(screen.getByText('Week 6, even week')).toBeTruthy();
  });

  it('header falls back for break and outside the semester', async () => {
    jest.setSystemTime(new Date(2026, 10, 10, 10, 25));
    await setup();
    expect(screen.getByText('Break')).toBeTruthy();
  });

  it('says outside the semester', async () => {
    jest.setSystemTime(new Date(2027, 2, 3, 10, 25));
    await setup();
    expect(screen.getByText('Outside the semester')).toBeTruthy();
  });

  it('marks the current class as now and formats subtitles', async () => {
    await setup();
    expect(screen.getAllByTestId('slot-now-line')).toHaveLength(1);
    const row = screen.getByRole('button', {
      name: /Teoria Sistemelor, course, 10:00 to 11:30/,
    });
    expect(row).toBeTruthy();
    expect(screen.getByText('Course in 048 with Mutescul A.')).toBeTruthy();
    expect(screen.getByText('Seminar in 12 with Popa I.')).toBeTruthy();
  });

  it('formats online and teacher-less subtitles', async () => {
    await setup({
      ...base,
      patterns: [pat({ online: true }), { ...p2, teacher: '' }],
    });
    expect(screen.getByText('Course, online with Mutescul A.')).toBeTruthy();
    expect(screen.getByText('Seminar in 12')).toBeTruthy();
  });

  it('shows thin rows after the last class ending in Free after', async () => {
    await setup();
    expect(screen.getByText('16:20')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('19:40')).toBeTruthy();
    expect(screen.queryByText('13:00')).toBeNull();
    expect(screen.getByText('Free after 16:10')).toBeTruthy();
  });

  it('shows No classes today on a day without classes', async () => {
    jest.setSystemTime(new Date(2026, 10, 7, 10, 25));
    await setup();
    expect(screen.getByText('No classes today.')).toBeTruthy();
  });

  it('shows the break copy', async () => {
    jest.setSystemTime(new Date(2026, 10, 10, 10, 25));
    await setup();
    expect(screen.getByText('No classes this week, it’s a break.')).toBeTruthy();
  });

  it('navigates to the class with its session id', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: /Teoria Sistemelor, course/ }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/class/[sessionId]',
      params: { sessionId: 'p1:2026-11-02' },
    });
  });

  it('moves the now marker after a minute passes the next start', async () => {
    jest.setSystemTime(new Date(2026, 10, 2, 14, 39, 30));
    await setup();
    expect(screen.queryAllByTestId('slot-now-line')).toHaveLength(0);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getAllByTestId('slot-now-line')).toHaveLength(1);
    expect(screen.getAllByText('14:40').length).toBeGreaterThan(1); // start + now tag
  });

  it('lists homework due this week and ticks it done', async () => {
    const hw = {
      id: 'h1',
      updatedAt: 1,
      title: 'Lab 3',
      subjectId: 'tss',
      due: '2026-11-03',
      dueTime: null,
      done: false,
    };
    const later = { ...hw, id: 'h2', title: 'Later', due: '2026-12-01' };
    const undated = { ...hw, id: 'h3', title: 'Undated', due: null };
    const { upsert } = await setup({ ...base, homework: [hw, later, undated] });
    expect(screen.queryByText(/Undated/)).toBeNull();
    expect(screen.getByText('Lab 3 for TSS')).toBeTruthy();
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.queryByText(/Later/)).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Lab 3' }));
    expect(upsert).toHaveBeenCalledWith(
      'homework',
      expect.objectContaining({ id: 'h1', done: true }),
    );
  });

  it('shows the next exam with the day count and opens exams', async () => {
    const exam = {
      id: 'e1',
      updatedAt: 1,
      subjectId: 'alg',
      title: 'Algebră',
      date: '2026-11-12',
      start: null,
      room: '',
    };
    await setup({ ...base, exams: [exam] });
    expect(screen.getByText('Next exam: Algebră, Thu 12 Nov')).toBeTruthy();
    expect(screen.getByText('10 days')).toBeTruthy();
    await fireEvent.press(screen.getByText('Next exam: Algebră, Thu 12 Nov'));
    expect(router.push).toHaveBeenCalledWith('/exams');
  });

  it('words the exam count for today and tomorrow', async () => {
    const exam = {
      id: 'e1',
      updatedAt: 1,
      subjectId: null,
      title: 'X',
      date: '2026-11-02',
      start: null,
      room: '',
    };
    await setup({ ...base, exams: [exam] });
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('words one day', async () => {
    const exam = {
      id: 'e1',
      updatedAt: 1,
      subjectId: null,
      title: 'X',
      date: '2026-11-03',
      start: null,
      room: '',
    };
    await setup({ ...base, exams: [exam] });
    expect(screen.getByText('1 day')).toBeTruthy();
  });

  it('prompts to set up the semester when empty', async () => {
    await setup({});
    expect(screen.getByText('Set up your semester')).toBeTruthy();
    expect(
      screen.getByText('Add your semester dates, then your classes, to see your day here.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Set up semester'));
    expect(router.push).toHaveBeenCalledWith('/settings/semester');
  });

  it('prompts to add classes when there are no patterns', async () => {
    await setup({ semester });
    expect(screen.getByText('Add your classes')).toBeTruthy();
    expect(screen.getByText('Add each class once and it repeats every week.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add a class'));
    expect(router.push).toHaveBeenCalledWith('/class/edit');
  });
});
