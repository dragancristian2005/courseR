import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Today from '../../app/(tabs)/index';
import Exams from '../../app/exams';
import EditExam from '../../app/exam/edit';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { ClassPattern, Exam, PlannerData, Semester, Subject } from '../../src/domain/types';

let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../../src/ui/useLayout', () => ({ useLayout: () => 'phone' }));

const semester: Semester = {
  id: 'sem',
  updatedAt: 1,
  name: 'Autumn',
  firstDay: '2026-09-28',
  lastDay: '2027-01-17',
  breaks: [],
  parityOverrides: {},
};
const tss: Subject = {
  id: 'tss',
  updatedAt: 1,
  name: 'Teoria Sistemelor',
  abbreviation: 'TSS',
  attending: true,
};
const p1: ClassPattern = {
  id: 'p1',
  updatedAt: 1,
  subjectId: 'tss',
  type: 'course',
  weekday: 1,
  start: '10:00',
  end: '11:30',
  room: '048',
  teacher: '',
  repeat: 'every',
  validFrom: '2026-09-28',
  validTo: null,
  online: false,
};
const ex = (over: Partial<Exam>): Exam => ({
  id: 'e1',
  updatedAt: 1,
  subjectId: 'tss',
  title: 'TSS exam',
  date: '2026-11-12',
  start: '09:00',
  room: '048',
  ...over,
});
const base: Partial<PlannerData> = {
  semester,
  subjects: [tss],
  patterns: [p1],
};

async function setup(Screen: React.ComponentType, initial: Partial<PlannerData> = base) {
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, 'upsert');
  const remove = jest.spyOn(repo, 'remove');
  await render(
    <StoreProvider repository={repo}>
      <Screen />
    </StoreProvider>,
  );
  return { repo, upsert, remove };
}
const press = async (name: string) => await fireEvent.press(screen.getByRole('button', { name }));
const type = async (label: string, value: string) =>
  await fireEvent.changeText(screen.getByLabelText(label), value);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
  jest.clearAllMocks();
  mockParams = {};
});
afterEach(() => jest.useRealTimers());

describe('Exams list', () => {
  it('orders Upcoming soonest first and Past most recent first', async () => {
    await setup(Exams, {
      ...base,
      exams: [
        ex({
          id: 'a',
          title: 'Later exam',
          date: '2026-11-20',
          start: null,
          room: '',
        }),
        ex({ id: 'b', title: 'Soon exam' }),
        ex({ id: 'c', title: 'Old one', date: '2026-10-01' }),
        ex({ id: 'd', title: 'Older one', date: '2026-09-01' }),
        ex({ id: 'e', title: 'Today exam', date: '2026-11-02' }),
      ],
    });
    expect(screen.getByText('Exams')).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('Past')).toBeTruthy();
    const titles = screen.getAllByTestId('exam-title').map((n) => n.props.children);
    expect(titles).toEqual(['Today exam', 'Soon exam', 'Later exam', 'Old one', 'Older one']);
    expect(screen.getByText('Thu 12 Nov, 09:00, room 048')).toBeTruthy();
    expect(screen.getByText('Fri 20 Nov')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('10 days')).toBeTruthy();
    expect(screen.getByText('18 days')).toBeTruthy();
  });

  it('says 1 day for tomorrow and shows the subject name', async () => {
    await setup(Exams, { ...base, exams: [ex({ date: '2026-11-03' })] });
    expect(screen.getByText('1 day')).toBeTruthy();
    expect(screen.getByText('Teoria Sistemelor')).toBeTruthy();
  });

  it('shows the empty state and Add exam', async () => {
    await setup(Exams);
    expect(screen.getByText('No exams yet. Add one when the dates are out.')).toBeTruthy();
    await press('Add exam');
    expect(router.push).toHaveBeenCalledWith('/exam/edit');
  });

  it('opens the editor on tap', async () => {
    await setup(Exams, { ...base, exams: [ex({})] });
    await fireEvent.press(screen.getByText('TSS exam'));
    expect(router.push).toHaveBeenCalledWith('/exam/edit?id=e1');
  });

  it('a past exam is not the next exam on Today', async () => {
    await setup(Today, { ...base, exams: [ex({ date: '2026-10-01' })] });
    expect(screen.queryByText(/Next exam/)).toBeNull();
  });
});

describe('Exam form', () => {
  it('saves an exam on 2026-11-12 and Today then shows 10 days', async () => {
    const { repo, upsert } = await setup(EditExam);
    await fireEvent.press(screen.getByRole('radio', { name: 'Teoria Sistemelor' }));
    await type('Title', 'x');
    await type('Title', '');
    expect(screen.getByText('Give the exam a title.')).toBeTruthy();
    await type('Date', 'nope');
    expect(screen.getByText('Enter a date like 2026-11-09.')).toBeTruthy();
    await type('Start time', '9');
    expect(screen.getByText('Enter a time like 09:40.')).toBeTruthy();
    await type('Title', 'TSS exam');
    await type('Date', '2026-11-12');
    await type('Start time', '09:00');
    await type('Room', '048');
    await press('Save exam');
    expect(upsert).toHaveBeenCalledWith(
      'exams',
      expect.objectContaining({
        title: 'TSS exam',
        subjectId: 'tss',
        date: '2026-11-12',
        start: '09:00',
        room: '048',
      }),
    );
    expect(router.back).toHaveBeenCalled();
    // Today now shows the countdown
    const other = createMemoryRepository({
      ...base,
      exams: [upsert.mock.calls[0][1] as Exam],
    });
    await render(
      <StoreProvider repository={other}>
        <Today />
      </StoreProvider>,
    );
    expect(screen.getByText('10 days')).toBeTruthy();
    expect(repo).toBeTruthy();
  });

  it('edits and deletes an existing exam', async () => {
    mockParams = { id: 'e1' };
    const { upsert, remove } = await setup(EditExam, {
      ...base,
      exams: [ex({})],
    });
    expect(screen.getByText('Edit exam')).toBeTruthy();
    expect(screen.getByLabelText('Room').props.value).toBe('048');
    await type('Room', '12');
    await press('Save exam');
    expect(upsert).toHaveBeenCalledWith('exams', expect.objectContaining({ id: 'e1', room: '12' }));
    await press('Delete exam');
    expect(screen.getByText('Delete this exam?')).toBeTruthy();
    await press('Delete');
    expect(remove).toHaveBeenCalledWith('exams', 'e1');
  });
});

describe('Missing record', () => {
  it('does not flash the missing screen after Delete', async () => {
    mockParams = { id: 'e1' };
    await setup(EditExam, { ...base, exams: [ex({})] });
    await press('Delete exam');
    await press('Delete');
    expect(screen.queryByText('This item no longer exists.')).toBeNull();
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a dead end instead of a create form', async () => {
    mockParams = { id: 'gone' };
    const { upsert } = await setup(EditExam);
    expect(screen.getByText('This item no longer exists.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
    await press('Go back');
    expect(router.back).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
