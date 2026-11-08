import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { existsSync } from 'fs';
import { join } from 'path';
import { router } from 'expo-router';
import ClassroomImport from '../../app/classroom/index';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  takeClassroomToken,
} from '../../src/data/classroom';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { Homework, PlannerData, Subject } from '../../src/domain/types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../src/data/classroom', () => {
  const messages: Record<string, string> = {
    denied: 'Classroom access wasn’t allowed.',
    blocked: 'Your school’s Google account doesn’t allow this app to read Classroom.',
    network: 'Couldn’t reach Google Classroom. Check your connection and try again.',
    other: 'Something went wrong reading Classroom. Try again.',
  };
  class ClassroomError extends Error {
    kind: string;
    constructor(kind: string) {
      super(messages[kind]);
      this.kind = kind;
    }
  }
  return {
    ClassroomError,
    getClassroomToken: jest.fn(),
    takeClassroomToken: jest.fn(),
    fetchClassroom: jest.fn(),
  };
});

const getToken = getClassroomToken as jest.Mock;
const takeToken = takeClassroomToken as jest.Mock;
const fetchC = fetchClassroom as jest.Mock;

const alg: Subject = {
  id: 'alg',
  updatedAt: 1,
  name: 'Algebra',
  abbreviation: 'ALG',
  attending: true,
};
const web: Subject = { id: 'web', updatedAt: 1, name: 'Web', abbreviation: 'WEB', attending: true };

const fetched = (over: Record<string, unknown> = {}) => ({
  courses: [{ id: 'c1', name: 'Algebra', section: null }],
  work: [
    {
      id: 'w1',
      courseId: 'c1',
      title: 'Problem set',
      dueDate: { year: 2026, month: 11, day: 20 },
      dueTime: null,
    },
    { id: 'w2', courseId: 'c1', title: 'Read ch. 2', dueDate: null, dueTime: null },
  ],
  turnedIn: new Set<string>(['w2']),
  ...over,
});

async function setup(initial: Partial<PlannerData> = { subjects: [alg, web] }) {
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, 'upsert');
  await render(
    <StoreProvider repository={repo}>
      <ClassroomImport />
    </StoreProvider>,
  );
  return { repo, upsert };
}
const press = async (name: string) =>
  await fireEvent.press(await screen.findByRole('button', { name }));

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
  jest.setSystemTime(new Date(2026, 10, 8, 10, 0));
  jest.clearAllMocks();
  takeToken.mockResolvedValue(null);
  getToken.mockResolvedValue('tok');
  fetchC.mockResolvedValue(fetched());
});
afterEach(() => jest.useRealTimers());

describe('Import from Classroom', () => {
  it('starts with copy and a hint, and connects through link and review to save', async () => {
    const { upsert } = await setup();
    expect(screen.getByText('Import from Classroom')).toBeTruthy();
    expect(
      screen.getByText(
        'Adds your Google Classroom assignments to Homework. Nothing is saved until you tap Save.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('You can choose any Google account, like your university one.'),
    ).toBeTruthy();
    await press('Connect to Classroom');
    expect(await screen.findByText('Which subject is each course?')).toBeTruthy();
    // suggestion preselected
    expect(screen.getByRole('radio', { name: 'Algebra', selected: true })).toBeTruthy();
    await press('Continue');
    expect(await screen.findByText('Problem set')).toBeTruthy();
    expect(screen.getByText('2 new, 0 updated')).toBeTruthy();
    expect(screen.getByText('No due date')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/homework'));
    const calls = upsert.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('classroomCourses');
    expect(calls.slice(1)).toEqual(['homework', 'homework']);
    const link = upsert.mock.calls[0][1];
    expect(link).toMatchObject({ id: 'c1', name: 'Algebra', subjectId: 'alg' });
  });

  it('Continue stays disabled until every course has a choice; Don’t import links nothing', async () => {
    fetchC.mockResolvedValue(
      fetched({ courses: [{ id: 'c9', name: 'Gym', section: null }], work: [] }),
    );
    const { upsert } = await setup();
    await press('Connect to Classroom');
    await screen.findByText('Which subject is each course?');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Don’t import' }));
    await press('Continue');
    expect(
      await screen.findByText('Everything from Classroom is already in your homework.'),
    ).toBeTruthy();
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][1]).toMatchObject({ id: 'c9', subjectId: null });
  });

  it('skips Connect when a redirect token is waiting', async () => {
    takeToken.mockResolvedValue('back');
    await setup();
    expect(await screen.findByText('Which subject is each course?')).toBeTruthy();
    expect(fetchC).toHaveBeenCalledWith('back');
    expect(getToken).not.toHaveBeenCalled();
    expect(takeToken).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['denied', 'Classroom access wasn’t allowed.'],
    ['blocked', 'Your school’s Google account doesn’t allow this app to read Classroom.'],
    ['network', 'Couldn’t reach Google Classroom. Check your connection and try again.'],
    ['other', 'Something went wrong reading Classroom. Try again.'],
  ])('shows the %s error with Try again', async (kind, message) => {
    getToken.mockRejectedValue(new ClassroomError(kind as never));
    await setup();
    await press('Connect to Classroom');
    expect(await screen.findByText(message)).toBeTruthy();
    getToken.mockResolvedValue('tok');
    await press('Try again');
    expect(await screen.findByText('Which subject is each course?')).toBeTruthy();
  });

  it('shows a fetch error', async () => {
    fetchC.mockRejectedValue(new ClassroomError('network'));
    await setup();
    await press('Connect to Classroom');
    expect(
      await screen.findByText(
        'Couldn’t reach Google Classroom. Check your connection and try again.',
      ),
    ).toBeTruthy();
  });

  it('says there is nothing to add when everything is imported already', async () => {
    const existing: Homework = {
      id: 'h1',
      updatedAt: 1,
      title: 'Problem set',
      subjectId: 'alg',
      due: '2026-11-20',
      dueTime: null,
      done: false,
      source: 'classroom',
      externalId: 'w1',
      imported: { title: 'Problem set', due: '2026-11-20', dueTime: null },
    };
    fetchC.mockResolvedValue(fetched({ work: [{ ...fetched().work[0] }], turnedIn: new Set() }));
    await setup({
      subjects: [alg],
      homework: [existing],
      classroomCourses: [{ id: 'c1', name: 'Algebra', subjectId: 'alg', updatedAt: 1 }],
    });
    await press('Connect to Classroom');
    expect(
      await screen.findByText('Everything from Classroom is already in your homework.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nothing to add' })).toBeDisabled();
  });

  it('needs a choice for each conflict before Save, and applies it', async () => {
    const existing: Homework = {
      id: 'h1',
      updatedAt: 1,
      title: 'My title',
      subjectId: 'alg',
      due: '2026-11-20',
      dueTime: null,
      done: false,
      source: 'classroom',
      externalId: 'w1',
      imported: { title: 'Old title', due: '2026-11-20', dueTime: null },
    };
    fetchC.mockResolvedValue(fetched({ work: [fetched().work[0]], turnedIn: new Set() }));
    const { upsert } = await setup({
      subjects: [alg],
      homework: [existing],
      classroomCourses: [{ id: 'c1', name: 'Algebra', subjectId: 'alg', updatedAt: 1 }],
    });
    await press('Connect to Classroom');
    expect(await screen.findByText('You changed this, and Classroom changed it too.')).toBeTruthy();
    expect(screen.getByText(/Yours: My title/)).toBeTruthy();
    expect(screen.getByText(/Classroom: Problem set/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Use Classroom’s' }));
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/homework'));
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][1]).toMatchObject({ id: 'h1', title: 'Problem set' });
  });

  it('shows a save failure and allows another try', async () => {
    const { repo } = await setup();
    jest.spyOn(repo, 'upsert').mockRejectedValueOnce(new Error('x'));
    await press('Connect to Classroom');
    await press('Continue');
    await press('Save');
    expect(await screen.findByText('Couldn’t save. Try again.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/homework'));
  });

  it('no longer has the spike route', () => {
    expect(existsSync(join(__dirname, '../../app/dev/classroom.tsx'))).toBe(false);
  });
});
