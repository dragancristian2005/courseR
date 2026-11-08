import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportExams from '../../app/import/exams';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import { clearPending, getPending, setPending } from '../../src/data/importSession';
import type { ExamImport, ImportFile } from '../../src/domain/importFormat';
import type { Exam, PlannerData } from '../../src/domain/types';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => true),
  },
}));

const exam = (o: Partial<ExamImport['exams'][number]>): ExamImport['exams'][number] => ({
  subject: 'BD',
  subjectName: 'Baze de date',
  title: null,
  date: '2027-01-21',
  start: '09:00',
  room: 'A02',
  groups: ['all'],
  unsure: [],
  ...o,
});
const file = (exams: ExamImport['exams'], groups: string[] = []): ExamImport => ({
  format: 'study-planner-import',
  version: 1,
  kind: 'exams',
  groups,
  exams,
});

const subjects = [
  ['s1', 'BD', 'Baze de date'],
  ['s2', 'SO', 'Sisteme de operare'],
  ['s3', 'A', 'Alpha'],
  ['s4', 'B', 'Beta'],
  ['s5', 'C', 'Gamma'],
].map(([id, abbreviation, name]) => ({ id, abbreviation, name, attending: true, updatedAt: 1 }));

async function setup(f: ImportFile | null, initial: Partial<PlannerData> = { subjects }) {
  if (f) setPending(f);
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, 'upsert');
  await render(
    <StoreProvider repository={repo}>
      <ImportExams />
    </StoreProvider>,
  );
  return { repo, upsert };
}
const press = async (name: string | RegExp) =>
  await fireEvent.press(screen.getByRole('button', { name }));
async function save() {
  await press('Save exams');
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPending();
});

describe('import exams review', () => {
  it('shows a message when nothing is pending or a timetable is', async () => {
    await setup(null);
    expect(screen.getByText('Nothing to review. Start an import from Settings.')).toBeTruthy();
    await press('Go to import');
    expect(router.push).toHaveBeenCalledWith('/import');
  });

  it('treats a pending timetable as nothing to review', async () => {
    await setup({
      format: 'study-planner-import',
      version: 1,
      kind: 'timetable',
      title: null,
      validFrom: null,
      groups: [],
      semigroups: [],
      subjects: [],
      blocks: [],
    } as unknown as ImportFile);
    expect(screen.getByText('Nothing to review. Start an import from Settings.')).toBeTruthy();
  });

  it('filters by group, preselecting a single group', async () => {
    await setup(
      file(
        [
          exam({ subject: 'BD', groups: ['A1'] }),
          exam({ subject: 'SO', subjectName: 'Sisteme de operare', groups: ['B2'] }),
        ],
        ['A1', 'B2'],
      ),
    );
    expect(screen.queryByText('Baze de date')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'A1' }));
    expect(screen.getByText('Baze de date')).toBeTruthy();
    expect(screen.queryByText('Sisteme de operare')).toBeNull();
  });

  it('says so when nothing is for the chosen group, and disables Save', async () => {
    await setup(file([exam({ groups: ['A1'] })], ['A1', 'B2']));
    await fireEvent.press(screen.getByRole('radio', { name: 'B2' }));
    expect(
      screen.getByText(
        'No exams for B2 on this sheet. Pick another group, or ask Claude to copy the group headers exactly.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('These exams are already in your planner.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save exams' })).toBeDisabled();
  });

  it('preselects a single group and shows the meta line', async () => {
    await setup(file([exam({ groups: ['A1'] })], ['A1']));
    expect(screen.getByText('Baze de date')).toBeTruthy();
    expect(screen.getByText('Thu 21 Jan, 09:00, room A02')).toBeTruthy();
  });

  it('omits missing parts of the meta line and sorts by date then start', async () => {
    await setup(
      file([
        exam({ subject: 'B', subjectName: 'Beta', date: '2027-01-22', start: null, room: null }),
        exam({ subject: 'A', subjectName: 'Alpha', date: '2027-01-21', start: '11:00' }),
        exam({ subject: 'C', subjectName: 'Gamma', date: '2027-01-21', start: '09:00' }),
      ]),
    );
    expect(screen.getByText('Fri 22 Jan')).toBeTruthy();
    const names = screen.getAllByTestId(/^exam-title-/).map((n) => n.props.children);
    expect(names).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('counts exams already in the planner', async () => {
    await setup(file([exam({}), exam({ subject: 'SO', subjectName: 'SO', date: '2027-01-25' })]), {
      subjects,
      exams: [
        {
          id: 'e1',
          updatedAt: 1,
          subjectId: 's1',
          title: 'Exam',
          date: '2027-01-21',
          start: '09:00',
          room: '',
        },
      ],
    });
    expect(screen.getByText('1 already in your planner')).toBeTruthy();
  });

  it('offers nothing to add when everything is already saved', async () => {
    await setup(file([exam({})]), {
      subjects,
      exams: [
        {
          id: 'e1',
          updatedAt: 1,
          subjectId: 's1',
          title: 'Exam',
          date: '2027-01-21',
          start: '09:00',
          room: '',
        },
      ],
    });
    expect(screen.getByText('These exams are already in your planner.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nothing to add' })).toBeDisabled();
  });

  it('saves the exams, clears the import and goes to Exams', async () => {
    const { upsert } = await setup(file([exam({ title: 'Final' })]));
    await save();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/exams');
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect((router.dismissAll as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (router.replace as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(getPending()).toBeNull();
    expect(upsert.mock.calls[0][0]).toBe('exams');
    expect(upsert.mock.calls[0][1]).toMatchObject({
      date: '2027-01-21',
      start: '09:00',
      room: 'A02',
    });
  });

  it('marks unsure exams, validates edits and saves them', async () => {
    const { upsert } = await setup(file([exam({ unsure: ['date', 'room'] })]));
    expect(screen.getByText('Check this: date and room may be misread.')).toBeTruthy();
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Date'), '2027-13-40');
    expect(screen.getByText('Enter a date like 2027-01-20.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save exams' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Start'), '9:7');
    expect(screen.getByText('Enter a time like 09:40.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Date'), '2027-01-20');
    await fireEvent.changeText(screen.getByLabelText('Start'), '10:00');
    await fireEvent.changeText(screen.getByLabelText('Room'), 'B7');
    await save();
    expect(upsert.mock.calls[0][1]).toMatchObject({
      date: '2027-01-20',
      start: '10:00',
      room: 'B7',
    });
  });

  it('keeps edits and the list when the store emits another snapshot mid-review', async () => {
    const { repo, upsert } = await setup(
      file([
        exam({ unsure: ['room'] }),
        exam({ subject: 'SO', subjectName: 'SO', date: '2027-01-25' }),
      ]),
    );
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Room'), 'Z9');
    await act(async () => {
      await repo.upsert('homework', {
        id: 'h1',
        updatedAt: 1,
        title: 'Read',
        subjectId: 's1',
        due: '2027-01-30',
        dueTime: null,
        done: false,
      });
    });
    expect(screen.getByLabelText('Room').props.value).toBe('Z9');
    expect(screen.getAllByTestId(/^exam-title-/)).toHaveLength(2);
    await save();
    const saved = upsert.mock.calls.filter((c) => c[0] === 'exams').map((c) => c[1] as Exam);
    expect(saved).toHaveLength(2);
    expect(saved.find((e) => e.date === '2027-01-21')?.room).toBe('Z9');
    expect(new Set(saved.map((e) => e.id)).size).toBe(2);
    expect(saved.every((e) => !e.id.startsWith('imp-'))).toBe(true);
  });

  it('skips on save an exam that was added to the planner meanwhile', async () => {
    const { repo, upsert } = await setup(file([exam({}), exam({ date: '2027-01-25' })]));
    await act(async () => {
      await repo.upsert('exams', {
        id: 'x1',
        updatedAt: 1,
        subjectId: 's1',
        title: 'Exam',
        date: '2027-01-25',
        start: '09:00',
        room: '',
      });
    });
    upsert.mockClear();
    await save();
    const saved = upsert.mock.calls.filter((c) => c[0] === 'exams').map((c) => c[1] as Exam);
    expect(saved.map((e) => e.date)).toEqual(['2027-01-21']);
  });

  it('saves an edited row that matches a saved exam only on the sheet’s date', async () => {
    const { repo, upsert } = await setup(
      file([exam({ unsure: ['date'] }), exam({ date: '2027-01-25' })]),
    );
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Date'), '2027-01-30');
    await act(async () => {
      await repo.upsert('exams', {
        id: 'x1',
        updatedAt: 1,
        subjectId: 's1',
        title: 'Exam',
        date: '2027-01-21',
        start: '09:00',
        room: '',
      });
    });
    upsert.mockClear();
    await save();
    const saved = upsert.mock.calls.filter((c) => c[0] === 'exams').map((c) => c[1] as Exam);
    expect(saved.map((e) => e.date).sort()).toEqual(['2027-01-25', '2027-01-30']);
  });

  it('skips an edited row whose new date and start are already saved', async () => {
    const { repo, upsert } = await setup(
      file([exam({ unsure: ['date'] }), exam({ date: '2027-01-25' })]),
    );
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Date'), '2027-02-02');
    await act(async () => {
      await repo.upsert('exams', {
        id: 'x1',
        updatedAt: 1,
        subjectId: 's1',
        title: 'Exam',
        date: '2027-02-02',
        start: '09:00',
        room: '',
      });
    });
    upsert.mockClear();
    await save();
    const saved = upsert.mock.calls.filter((c) => c[0] === 'exams').map((c) => c[1] as Exam);
    expect(saved.map((e) => e.date)).toEqual(['2027-01-25']);
  });

  it('says the exams were already saved when every row is a duplicate by Save time', async () => {
    const { repo, upsert } = await setup(file([exam({})]));
    await act(async () => {
      await repo.upsert('exams', {
        id: 'x1',
        updatedAt: 1,
        subjectId: 's1',
        title: 'Exam',
        date: '2027-01-21',
        start: '09:00',
        room: '',
      });
    });
    upsert.mockClear();
    await save();
    expect(upsert).not.toHaveBeenCalled();
    expect(screen.getByText('These exams were already saved.')).toBeTruthy();
    expect(router.replace).toHaveBeenCalledWith('/exams');
    expect(getPending()).toBeNull();
  });

  it('words the empty sheet naturally when it lists no groups', async () => {
    await setup(file([]));
    expect(screen.getByText('No exams found in this sheet.')).toBeTruthy();
    expect(screen.queryByText(/No exams for all/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save exams' })).toBeDisabled();
  });

  it('shows an error and allows a retry when saving fails', async () => {
    const { upsert } = await setup(file([exam({})]));
    upsert.mockRejectedValueOnce(new Error('x'));
    await press('Save exams');
    await waitFor(() => expect(screen.getByText('Couldn’t save. Try again.')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
    await save();
  });
});
