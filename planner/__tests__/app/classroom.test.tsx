import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { existsSync } from 'fs';
import { join } from 'path';
import { router } from 'expo-router';
import ClassroomImport from '../../app/classroom/index';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  prepareClassroomSignIn,
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
    popupBlocked:
      'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
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
    prepareClassroomSignIn: jest.fn(),
    takeClassroomToken: jest.fn(),
    fetchClassroom: jest.fn(),
  };
});

const getToken = getClassroomToken as jest.Mock;
const takeToken = takeClassroomToken as jest.Mock;
const fetchC = fetchClassroom as jest.Mock;
const prepare = prepareClassroomSignIn as jest.Mock;

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
  failedCourses: [],
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
const group = (name: string) => {
  const found = screen
    .getAllByLabelText(name)
    .find((e) => e.props.accessibilityRole === 'radiogroup');
  if (!found) throw new Error(`no choice for ${name}`);
  return found;
};
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

  it('tapping a chosen subject or Don’t import again clears the choice', async () => {
    fetchC.mockResolvedValue(
      fetched({
        courses: [{ id: 'c9', name: 'Gym', section: null }],
        work: [{ ...fetched().work[0], courseId: 'c9' }],
      }),
    );
    await setup();
    await press('Connect to Classroom');
    await screen.findByText('Which subject is each course?');
    const skip = () => screen.getByRole('radio', { name: 'Don’t import' });
    await fireEvent.press(skip());
    expect(screen.getByRole('radio', { name: 'Don’t import', selected: true })).toBeTruthy();
    await fireEvent.press(skip());
    expect(screen.getByRole('radio', { name: 'Don’t import', selected: false })).toBeTruthy();
  });

  it('Continue is always enabled; a course left without a choice is skipped and not linked', async () => {
    fetchC.mockResolvedValue(
      fetched({
        courses: [{ id: 'c9', name: 'Gym', section: null }],
        work: [{ ...fetched().work[0], courseId: 'c9' }],
      }),
    );
    const { upsert } = await setup();
    await press('Connect to Classroom');
    await screen.findByText('Which subject is each course?');
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
    await press('Continue');
    expect(
      await screen.findByText('Everything from Classroom is already in your homework.'),
    ).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('Don’t import links the course to nothing', async () => {
    fetchC.mockResolvedValue(
      fetched({
        courses: [{ id: 'c9', name: 'Gym', section: null }],
        work: [{ ...fetched().work[0], courseId: 'c9' }],
      }),
    );
    const { upsert } = await setup();
    await press('Connect to Classroom');
    await screen.findByText('Which subject is each course?');
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
    [
      'popupBlocked',
      'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    ],
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

  it('does not bring back an imported homework the student deleted', async () => {
    fetchC.mockResolvedValue(fetched({ work: [fetched().work[0]], turnedIn: new Set() }));
    const repo = createMemoryRepository({
      subjects: [alg],
      classroomCourses: [{ id: 'c1', name: 'Algebra', subjectId: 'alg', updatedAt: 1 }],
    });
    const upsert = jest.spyOn(repo, 'upsert');
    const ui = (
      <StoreProvider repository={repo}>
        <ClassroomImport />
      </StoreProvider>
    );
    const first = await render(ui);
    await press('Connect to Classroom');
    expect(await screen.findByText('1 new, 0 updated')).toBeTruthy();
    await press('Save');
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const saved = upsert.mock.calls[0][1] as Homework;
    expect(saved).toMatchObject({ source: 'classroom', externalId: 'w1' });
    await repo.remove('homework', saved.id);
    await first.unmount();
    upsert.mockClear();

    await render(ui);
    await press('Connect to Classroom');
    expect(
      await screen.findByText('Everything from Classroom is already in your homework.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nothing to add' })).toBeDisabled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('a snapshot-only refresh is not shown, and rides along with the next real save', async () => {
    const edited: Homework = {
      id: 'h1',
      updatedAt: 1,
      title: 'Problem set',
      subjectId: 'alg',
      due: '2026-11-20',
      dueTime: null,
      done: false,
      source: 'classroom',
      externalId: 'w1',
      imported: { title: 'Old title', due: '2026-11-20', dueTime: null },
    };
    const links = [{ id: 'c1', name: 'Algebra', subjectId: 'alg', updatedAt: 1 }];
    fetchC.mockResolvedValue(fetched({ work: [fetched().work[0]], turnedIn: new Set() }));
    const first = await setup({ subjects: [alg], homework: [edited], classroomCourses: links });
    await press('Connect to Classroom');
    expect(
      await screen.findByText('Everything from Classroom is already in your homework.'),
    ).toBeTruthy();
    expect(screen.queryByText('Updated')).toBeNull();
    expect(screen.queryByText('Problem set')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nothing to add' })).toBeDisabled();
    expect(first.upsert).not.toHaveBeenCalled();
    await screen.unmount();

    fetchC.mockResolvedValue(fetched({ turnedIn: new Set() }));
    const { upsert } = await setup({
      subjects: [alg],
      homework: [edited],
      classroomCourses: links,
    });
    await press('Connect to Classroom');
    expect(await screen.findByText('1 new, 0 updated')).toBeTruthy();
    expect(screen.queryByText('Updated')).toBeNull();
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/homework'));
    const saved = upsert.mock.calls.map((c) => c[1] as Homework);
    expect(saved).toHaveLength(2);
    expect(saved.find((h) => h.id === 'h1')).toMatchObject({
      title: 'Problem set',
      imported: { title: 'Problem set' },
    });
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

  it('sets up the Classroom sign-in when the screen opens', async () => {
    await setup();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('says it is opening Google while the page redirects', async () => {
    getToken.mockResolvedValue('redirecting');
    await setup();
    await press('Connect to Classroom');
    expect(await screen.findByText('Opening Google…')).toBeTruthy();
  });

  it('returns to Connect when the page comes back from the back-forward cache', async () => {
    const win = (globalThis as any).window;
    const handlers: Record<string, (e: { persisted?: boolean }) => void> = {};
    win.addEventListener = jest.fn((t: string, fn: (e: { persisted?: boolean }) => void) => {
      handlers[t] = fn;
    });
    win.removeEventListener = jest.fn();
    try {
      getToken.mockResolvedValue('redirecting');
      await setup();
      await press('Connect to Classroom');
      await screen.findByText('Opening Google…');
      expect(takeToken).toHaveBeenCalledTimes(1);
      await act(async () => handlers.pageshow({ persisted: false }));
      expect(screen.getByText('Opening Google…')).toBeTruthy();
      await act(async () => handlers.pageshow({ persisted: true }));
      expect(await screen.findByRole('button', { name: 'Connect to Classroom' })).toBeTruthy();
      expect(takeToken).toHaveBeenCalledTimes(2);
    } finally {
      delete win.addEventListener;
      delete win.removeEventListener;
    }
  });

  it('says so when the Google account has no Classroom courses', async () => {
    fetchC.mockResolvedValue(fetched({ courses: [], work: [] }));
    await setup();
    await press('Connect to Classroom');
    expect(
      await screen.findByText(
        'This Google account has no Classroom courses. Try again and choose your university account.',
      ),
    ).toBeTruthy();
    fetchC.mockResolvedValue(fetched());
    await press('Try again');
    expect(await screen.findByText('Which subject is each course?')).toBeTruthy();
  });

  it('names the courses it could not read', async () => {
    fetchC.mockResolvedValue(fetched({ failedCourses: ['Bio', 'Chem'] }));
    await setup();
    await press('Connect to Classroom');
    await press('Continue');
    expect(await screen.findByText('Couldn’t read 2 courses: Bio, Chem.')).toBeTruthy();
  });

  it('preselects Don’t import only for a course with no suggestion and nothing to import', async () => {
    fetchC.mockResolvedValue(
      fetched({
        courses: [
          { id: 'c8', name: 'Old club', section: null },
          { id: 'c9', name: 'Gym', section: null },
        ],
        work: [
          {
            id: 'old',
            courseId: 'c8',
            title: 'Last year',
            dueDate: { year: 2025, month: 3, day: 1 },
            dueTime: null,
          },
          { ...fetched().work[0], courseId: 'c9' },
        ],
        turnedIn: new Set(['old']),
      }),
    );
    await setup();
    await press('Connect to Classroom');
    await screen.findByText('Which subject is each course?');
    const club = group('Old club');
    const gym = group('Gym');
    expect(within(club).getByRole('radio', { name: 'Don’t import', selected: true })).toBeTruthy();
    expect(within(gym).queryByRole('radio', { selected: true })).toBeNull();
  });

  it('changes course links from the review, starting from the current ones', async () => {
    fetchC.mockResolvedValue(
      fetched({
        courses: [
          { id: 'c1', name: 'Algebra', section: null },
          { id: 'c2', name: 'Web dev', section: null },
        ],
        work: [fetched().work[0], { ...fetched().work[0], id: 'w9', courseId: 'c2' }],
        turnedIn: new Set(),
      }),
    );
    const { upsert } = await setup({
      subjects: [alg, web],
      classroomCourses: [
        { id: 'c1', name: 'Algebra', subjectId: 'alg', updatedAt: 1 },
        { id: 'c2', name: 'Web dev', subjectId: null, updatedAt: 1 },
      ],
    });
    await press('Connect to Classroom');
    expect(await screen.findByText('1 new, 0 updated')).toBeTruthy();
    await press('Change course links');
    expect(await screen.findByText('Which subject is each course?')).toBeTruthy();
    const algebra = group('Algebra');
    const webDev = group('Web dev');
    expect(within(algebra).getByRole('radio', { name: 'Algebra', selected: true })).toBeTruthy();
    expect(
      within(webDev).getByRole('radio', { name: 'Don’t import', selected: true }),
    ).toBeTruthy();
    await fireEvent.press(within(webDev).getByRole('radio', { name: 'Web' }));
    await press('Continue');
    expect(await screen.findByText('2 new, 0 updated')).toBeTruthy();
    await press('Save');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/homework'));
    const courses = upsert.mock.calls.filter((c) => c[0] === 'classroomCourses');
    expect(courses).toHaveLength(1);
    expect(courses[0][1]).toMatchObject({ id: 'c2', subjectId: 'web' });
    expect((courses[0][1] as { updatedAt: number }).updatedAt).toBeGreaterThan(1);
  });

  it('no longer has the spike route', () => {
    expect(existsSync(join(__dirname, '../../app/dev/classroom.tsx'))).toBe(false);
  });
});
