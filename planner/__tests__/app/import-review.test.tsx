import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportReview from '../../app/import/review';
import ImportStart from '../../app/import/index';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import { clearPending, getPending, setPending } from '../../src/data/importSession';
import { OPEN_START } from '../../src/domain/edits';
import { parseImport } from '../../src/domain/importParse';
import type { ImportFile, TimetableImport } from '../../src/domain/importFormat';
import type {
  ClassPattern,
  Note,
  PlannerData,
  SessionOverride,
  Subject,
} from '../../src/domain/types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const raw = JSON.stringify(require('../fixtures/uvt-info3.json'));
const load = (text: string): TimetableImport => {
  const r = parseImport(text);
  if (!r.ok || r.file.kind !== 'timetable') throw new Error('bad fixture');
  return r.file;
};
const uvt = load(raw);

async function setup(file: ImportFile | null, initial: Partial<PlannerData> = {}) {
  if (file) setPending(file);
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, 'upsert');
  await render(
    <StoreProvider repository={repo}>
      <ImportReview />
    </StoreProvider>,
  );
  return { repo, upsert };
}
const press = async (name: string | RegExp) =>
  await fireEvent.press(screen.getByRole('button', { name }));
const radio = async (name: string | RegExp) =>
  await fireEvent.press(screen.getByRole('radio', { name }));
/** Press Save and wait for the save to finish (it navigates last). */
async function save() {
  await press('Save timetable');
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
}
const chooseGroup1 = async () => await radio('Grupa 1');
/** Answer every open question of Grupa 1. */
async function answerAll() {
  await radio(/^Robotic Process Automation, course/);
  await radio(/^Șabloane de proiectare, course/);
  await radio(/^Dezvoltare cu tehnologii cloud, course, Wednesday/);
  await radio('Course');
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPending();
});

describe('import review', () => {
  it('shows a message when nothing is pending', async () => {
    await setup(null);
    expect(screen.getByText('Nothing to review. Start an import from Settings.')).toBeTruthy();
    await press('Go to import');
    expect(router.push).toHaveBeenCalledWith('/import');
  });

  it('treats a pending exams file as nothing to review', async () => {
    const exams = parseImport(
      JSON.stringify({
        format: 'study-planner-import',
        version: 1,
        kind: 'exams',
        groups: ['A1'],
        exams: [{ subject: 'MATH', date: '2027-01-20', start: '09:00', groups: ['all'] }],
      }),
    );
    if (!exams.ok) throw new Error('bad');
    await setup(exams.file);
    expect(screen.getByText('Nothing to review. Start an import from Settings.')).toBeTruthy();
  });

  it('clears a stale pending import when the import flow starts', async () => {
    setPending(uvt);
    await render(<ImportStart />);
    expect(getPending()).toBeNull();
  });

  it('shows the heading, the title and group chips, and nothing else until a group is chosen', async () => {
    await setup(uvt);
    expect(screen.getByText('Check your timetable')).toBeTruthy();
    expect(screen.getByText('Informatică anul 3, semestrul I 2026–2027')).toBeTruthy();
    expect(screen.getByText('Which group are you in?')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(screen.queryByText(/classes found/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save timetable' })).toBeNull();
  });

  it('shows only the chosen group’s blocks, by day, with the summary', async () => {
    await setup(uvt);
    await chooseGroup1();
    expect(
      screen.getByText('16 classes found, 5 need a look. Nothing is saved until you tap Save.'),
    ).toBeTruthy();
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getByText('Thursday')).toBeTruthy();
    expect(screen.queryByText('Friday')).toBeNull();
    expect(screen.getAllByText('Inginerie software pentru testare').length).toBeGreaterThan(0);
    // Grupa 5 only block is absent
    expect(screen.queryByText('Sisteme informatice integrate și aplicații')).toBeNull();
    await radio('Grupa 5');
    expect(
      screen.getAllByText('Sisteme informatice integrate și aplicații').length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText('Inginerie software pentru testare')).toHaveLength(0);
  });

  it('says so when the chosen group has no classes, and disables Save', async () => {
    const only = { ...uvt, groups: ['Grupa 1', 'Grupa 9'], blocks: [uvt.blocks[0]] };
    await setup(only);
    await radio('Grupa 9');
    expect(
      screen.getByText(
        'No classes for Grupa 9 on this sheet. Pick another group, or ask Claude to copy the group headers exactly.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/classes found/)).toBeNull();
    expect(screen.queryByText('Subjects')).toBeNull();
    expect(screen.queryByText('Everything on this sheet is already in your planner.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save timetable' })).toBeDisabled();
  });

  it('names the semigroup when a semigroup has no classes', async () => {
    const f: TimetableImport = {
      ...uvt,
      groups: ['Grupa 1'],
      semigroups: ['1', '2'],
      blocks: [{ ...uvt.blocks[0], groups: ['Grupa 1'], semigroup: '1' }],
    };
    await setup(f);
    await radio('2');
    expect(
      screen.getByText(
        'No classes for Grupa 1, semigroup 2 on this sheet. Pick another group, or ask Claude to copy the group headers exactly.',
      ),
    ).toBeTruthy();
  });

  it('asks which Monday 13:00 alternative is attended, with a red outline until answered', async () => {
    await setup(uvt);
    await chooseGroup1();
    expect(
      screen.getAllByText('These classes are alternatives. Which do you attend?').length,
    ).toBeGreaterThan(0);
    const rpaOption = screen.getByRole('radio', {
      name: 'Robotic Process Automation, course, A02, Monday 13:00–14:30',
    });
    expect(rpaOption).toBeTruthy();
    expect(screen.getByTestId('import-block-3')).toHaveStyle({ borderColor: '#C8302A' });
    await radio(/^Robotic Process Automation, course/);
    expect(screen.getByTestId('import-block-3')).not.toHaveStyle({ borderColor: '#C8302A' });
  });

  it('keeps Save disabled until every question is answered', async () => {
    await setup(uvt);
    await chooseGroup1();
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByText('Answer the 4 questions above to save.')).toBeTruthy();
    expect(
      screen.getByText('The sheet doesn’t say if this is a course, seminar or lab.'),
    ).toBeTruthy();
    await answerAll();
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(false);
    expect(screen.queryByText(/above to save/)).toBeNull();
  });

  it('lists only subjects of kept classes, grouping ȘP and SP', async () => {
    await setup(uvt);
    await chooseGroup1();
    // unanswered: all options listed
    expect(
      screen.getByRole('switch', { name: 'Introducere în tehnologii blockchain' }),
    ).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Grafică și jocuri simple' })).toBeTruthy();
    expect(screen.getAllByRole('switch', { name: 'Șabloane de proiectare' })).toHaveLength(1);
    await answerAll();
    expect(
      screen.queryByRole('switch', { name: 'Introducere în tehnologii blockchain' }),
    ).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Grafică și jocuri simple' })).toBeNull();
    // ȘP is still kept through the chosen alternative
    expect(screen.getAllByRole('switch', { name: 'Șabloane de proiectare' })).toHaveLength(1);
  });

  it('saves subjects then patterns, honouring a switched-off subject', async () => {
    const { upsert } = await setup(uvt);
    await chooseGroup1();
    await answerAll();
    await fireEvent.press(screen.getByRole('switch', { name: 'Administrarea rețelelor' }));
    await save();
    const calls = upsert.mock.calls;
    const firstPattern = calls.findIndex((c) => c[0] === 'patterns');
    const lastSubject = calls.map((c) => c[0]).lastIndexOf('subjects');
    expect(lastSubject).toBeLessThan(firstPattern);
    const subjects = calls.filter((c) => c[0] === 'subjects').map((c) => c[1] as Subject);
    const patterns = calls.filter((c) => c[0] === 'patterns').map((c) => c[1] as ClassPattern);
    expect(subjects.map((s) => s.abbreviation).sort()).toEqual(
      ['AR', 'ALED', 'DCT', 'ITB', 'RPA', 'TSS', 'ȘP'].sort(),
    );
    expect(subjects.find((s) => s.abbreviation === 'AR')?.attending).toBe(false);
    expect(subjects.find((s) => s.abbreviation === 'ITB')?.attending).toBe(true);
    // 15 blocks minus 4 dropped alternatives (IBC, PSTR, GJS, DCT Thursday)
    expect(patterns).toHaveLength(16 - 4);
    expect(patterns.every((p) => p.source === 'import' && p.validFrom === OPEN_START)).toBe(true);
    expect(patterns.every((p) => subjects.some((s) => s.id === p.subjectId))).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(getPending()).toBeNull();
  });

  it('marks existing subjects as already in the planner', async () => {
    const rpa: Subject = {
      id: 'rpa',
      name: 'Robotic Process Automation',
      abbreviation: 'RPA',
      attending: true,
      updatedAt: 1,
    };
    await setup(uvt, { subjects: [rpa] });
    await chooseGroup1();
    expect(screen.getAllByText('Already in your planner')).toHaveLength(1);
  });

  it('preselects the only group and the only semigroup', async () => {
    const one: TimetableImport = { ...uvt, groups: ['Grupa 1'], semigroups: ['A'] };
    await setup(one);
    expect(screen.getByRole('radio', { name: 'Grupa 1' }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByRole('radio', { name: 'A' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(/classes found/)).toBeTruthy();
  });

  it('asks for the semigroup when there are several, and resets answers when the group changes', async () => {
    const two: TimetableImport = { ...uvt, semigroups: ['A', 'B'] };
    await setup(two);
    await chooseGroup1();
    expect(screen.getByText('Which semigroup?')).toBeTruthy();
    expect(screen.queryByText(/classes found/)).toBeNull();
    await radio('A');
    expect(screen.getByText(/classes found/)).toBeTruthy();
    await answerAll();
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(false);
    await radio('Grupa 2');
    expect(screen.getByText(/classes found/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('lets an unsure block be edited inline', async () => {
    const { upsert } = await setup(uvt);
    await chooseGroup1();
    await answerAll();
    expect(screen.getByText('Check this: type may be misread.')).toBeTruthy();
    await press('Edit');
    await fireEvent.changeText(screen.getByLabelText('Room'), '060');
    await save();
    const patterns = upsert.mock.calls
      .filter((c) => c[0] === 'patterns')
      .map((c) => c[1] as ClassPattern);
    expect(patterns.some((p) => p.room === '060' && p.start === '09:40')).toBe(true);
  });
});

describe('import review inline edit validation', () => {
  async function toEditor() {
    const r = await setup(uvt);
    await chooseGroup1();
    await answerAll();
    await press('Edit');
    return r;
  }
  const saveDisabled = () =>
    screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled;

  it('blocks Save for an empty subject until it is filled again', async () => {
    await toEditor();
    const subject = screen.getByLabelText('Subject');
    await fireEvent.changeText(subject, '   ');
    expect(screen.getByText('Enter the subject.')).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    expect(screen.getByText('Fix the highlighted classes to save.')).toBeTruthy();
    await fireEvent.changeText(subject, 'TSS');
    expect(saveDisabled()).toBe(false);
    expect(screen.queryByText('Fix the highlighted classes to save.')).toBeNull();
  });

  it('blocks Save for a bad time and for an end that is not after the start', async () => {
    await toEditor();
    await fireEvent.changeText(screen.getByLabelText('Start'), '9:4');
    expect(screen.getByText('Enter a time like 09:40.')).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Start'), '12:00');
    expect(screen.getByText('The class must end after it starts.')).toBeTruthy();
    expect(saveDisabled()).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('End'), '13:00');
    expect(saveDisabled()).toBe(false);
  });

  it('keeps the editor open while invalid and clears the block when the group changes', async () => {
    await toEditor();
    await fireEvent.changeText(screen.getByLabelText('End'), '09:00');
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    await radio('Grupa 2');
    expect(screen.queryByText('Fix the highlighted classes to save.')).toBeNull();
  });
});

describe('import review of an already imported timetable', () => {
  async function importedState() {
    // First import, answered the same way every time
    const first = await setup(uvt);
    await chooseGroup1();
    await answerAll();
    await save();
    let data: PlannerData | null = null;
    const off = first.repo.subscribe(
      (d) => (data = d),
      () => {},
      () => {},
    );
    off();
    if (data === null) throw new Error('no data');
    jest.clearAllMocks();
    clearPending();
    return data as PlannerData;
  }

  it('shows 0 new, 0 removed, N unchanged and saves nothing for the same file', async () => {
    const data = await importedState();
    await screen.unmount();
    const { upsert } = await setup(uvt, data);
    await chooseGroup1();
    await answerAll();
    expect(screen.getByText('0 new, 0 removed, 12 unchanged')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Nothing to change' }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(screen.getByText('Everything on this sheet is already in your planner.')).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('defaults the from date to the later of today and the file’s validFrom', async () => {
    const data = await importedState();
    await screen.unmount();
    await setup({ ...uvt, validFrom: '2999-01-04' }, data);
    await chooseGroup1();
    expect(screen.getByLabelText('Apply changes from').props.value).toBe('2999-01-04');
  });

  it('lists new and removed classes, warns about dropped changes and saves the diff', async () => {
    const data = await importedState();
    await screen.unmount();
    const rpaSeminar = data.patterns.find((p) => p.type === 'seminar' && p.start === '18:00');
    if (!rpaSeminar) throw new Error('missing');
    const override: SessionOverride = {
      id: 'o1',
      sessionId: `${rpaSeminar.id}:2999-01-11`,
      kind: 'cancel',
      updatedAt: 1,
    } as unknown as SessionOverride;
    const note: Note = {
      id: 'n1',
      sessionId: `${rpaSeminar.id}:2999-01-11`,
      text: 'x',
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Note;
    // The new sheet has no RPA seminar for Grupa 2? Simulate: drop it, and shift AR by a room.
    const changed: TimetableImport = {
      ...uvt,
      validFrom: '2999-01-04',
      blocks: uvt.blocks
        .filter((b) => !(b.subject === 'RPA' && b.type === 'seminar'))
        .map((b) => (b.subject === 'AR' ? { ...b, room: 'B1' } : b)),
    };
    const { upsert } = await setup(changed, { ...data, overrides: [override], notes: [note] });
    await chooseGroup1();
    await answerAll();
    expect(screen.getByText('1 new, 2 removed, 10 unchanged')).toBeTruthy();
    expect(screen.getByText('New classes')).toBeTruthy();
    expect(screen.getByText('Removed classes')).toBeTruthy();
    expect(
      screen.getByText('Monday 14:40–16:10, Administrarea rețelelor, course, B1'),
    ).toBeTruthy();
    expect(
      screen.getByText('Monday 14:40–16:10, Administrarea rețelelor, course, A02'),
    ).toBeTruthy();
    expect(
      screen.getByText('Monday 18:00–19:30, Robotic Process Automation, seminar, 033'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '1 one-off change and 1 note on or after Fri 4 Jan won’t carry over to the new schedule. Your notes stay in Notes.',
      ),
    ).toBeTruthy();
    await save();
    const patterns = upsert.mock.calls
      .filter((c) => c[0] === 'patterns')
      .map((c) => c[1] as ClassPattern);
    expect(patterns).toHaveLength(3);
    expect(patterns.filter((p) => p.validFrom === '2999-01-04' && !p.deleted)).toHaveLength(1);
    expect(patterns.filter((p) => p.validTo === '2999-01-03')).toHaveLength(2);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('rejects a from date that is not YYYY-MM-DD', async () => {
    const data = await importedState();
    await screen.unmount();
    await setup({ ...uvt, blocks: uvt.blocks.filter((b) => b.subject !== 'AR') }, data);
    await chooseGroup1();
    await answerAll();
    await fireEvent.changeText(screen.getByLabelText('Apply changes from'), '9 Nov');
    expect(screen.getByText('Enter a date like 2026-11-09.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('shows a class that returns after being ended as new, and saves it from the chosen date', async () => {
    const data0 = await importedState();
    await screen.unmount();
    const withoutAr: TimetableImport = {
      ...uvt,
      blocks: uvt.blocks.filter((b) => b.subject !== 'AR'),
    };
    const second = await setup(withoutAr, data0);
    await chooseGroup1();
    await answerAll();
    await fireEvent.changeText(screen.getByLabelText('Apply changes from'), '2999-01-04');
    await save();
    const data1 = (() => {
      let d: PlannerData | null = null;
      second.repo.subscribe(
        (x) => (d = x),
        () => {},
        () => {},
      )();
      return d as unknown as PlannerData;
    })();
    expect(data1.patterns.some((p) => p.validTo === '2999-01-03')).toBe(true);
    await screen.unmount();
    clearPending();
    jest.clearAllMocks();
    const third = await setup(uvt, data1);
    await chooseGroup1();
    await answerAll();
    await fireEvent.changeText(screen.getByLabelText('Apply changes from'), '2999-02-01');
    expect(screen.getByText('1 new, 0 removed, 11 unchanged')).toBeTruthy();
    expect(
      screen.getByText('Monday 14:40–16:10, Administrarea rețelelor, course, A02'),
    ).toBeTruthy();
    await save();
    const saved = third.upsert.mock.calls
      .filter((c) => c[0] === 'patterns')
      .map((c) => c[1] as ClassPattern);
    expect(saved).toHaveLength(1);
    expect(saved[0].validFrom).toBe('2999-02-01');
  });

  it('saves once when Save is pressed twice in a row', async () => {
    const { upsert } = await setup(uvt);
    await chooseGroup1();
    await answerAll();
    const save = screen.getByRole('button', { name: 'Save timetable' });
    await fireEvent.press(save);
    await fireEvent.press(save);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const patterns = upsert.mock.calls.filter((c) => c[0] === 'patterns');
    expect(patterns).toHaveLength(12);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('still saves when only an existing subject’s switch changed', async () => {
    const data = await importedState();
    await screen.unmount();
    const { upsert } = await setup(uvt, data);
    await chooseGroup1();
    await answerAll();
    expect(screen.getByRole('button', { name: 'Nothing to change' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Administrarea rețelelor' }));
    expect(
      screen.getByRole('button', { name: 'Save timetable' }).props.accessibilityState.disabled,
    ).toBe(false);
    await save();
    expect(upsert.mock.calls.filter((c) => c[0] === 'patterns')).toHaveLength(0);
    const subjects = upsert.mock.calls
      .filter((c) => c[0] === 'subjects')
      .map((c) => c[1] as Subject);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].attending).toBe(false);
  });

  it('labels the alternatives radio group with the question', async () => {
    await setup(uvt);
    await chooseGroup1();
    expect(
      screen.getAllByLabelText('These classes are alternatives. Which do you attend?').length,
    ).toBe(3);
  });
});
