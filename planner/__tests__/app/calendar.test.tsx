import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CalendarScreen from '../../app/settings/calendar';
import Settings from '../../app/settings/index';
import { openCalendarFile, shareCalendarFile } from '../../src/data/calendarFile';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { PlannerData } from '../../src/domain/types';

jest.mock('../../src/data/auth', () => ({ useAuth: jest.fn(() => ({ signOut: jest.fn() })) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../src/data/calendarFile', () => ({
  openCalendarFile: jest.fn(),
  shareCalendarFile: jest.fn(),
}));

const save = openCalendarFile as jest.Mock;
const share = shareCalendarFile as jest.Mock;

const FAKE_DATE_ONLY = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'nextTick',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'performance',
  'hrtime',
] as const;

// Wednesday 2026-11-04; its Monday is 2026-11-02.
beforeAll(() =>
  jest.useFakeTimers({ now: new Date('2026-11-04T10:00:00'), doNotFake: [...FAKE_DATE_ONLY] }),
);
afterAll(() => jest.useRealTimers());
beforeEach(() => jest.clearAllMocks());

const data: Partial<PlannerData> = {
  semester: {
    id: 's1',
    updatedAt: 0,
    name: 'Fall',
    firstDay: '2026-09-28',
    lastDay: '2027-01-15',
    breaks: [],
    parityOverrides: {},
  },
  subjects: [{ id: 'sub1', updatedAt: 0, name: 'Algebra', abbreviation: 'ALG', attending: true }],
  patterns: [
    {
      id: 'p1',
      updatedAt: 0,
      subjectId: 'sub1',
      type: 'seminar',
      weekday: 1,
      start: '08:00',
      end: '09:30',
      room: '048',
      teacher: '',
      repeat: 'every',
      validFrom: '2026-09-28',
      validTo: null,
      online: false,
    },
  ],
  exams: [
    {
      id: 'e1',
      updatedAt: 0,
      subjectId: 'sub1',
      title: 'Final',
      date: '2026-12-10',
      start: null,
      room: '',
    },
  ],
};

async function setup(initial: Partial<PlannerData> = data) {
  await render(
    <StoreProvider repository={createMemoryRepository(initial)}>
      <CalendarScreen />
    </StoreProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeTruthy());
}

const button = () => screen.getByRole('button', { name: 'Add to calendar' });
const NOTHING = 'Nothing to add yet. Set up your semester and classes, or add an exam.';

describe('settings row', () => {
  it('opens the calendar screen', async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to calendar' }));
    expect(router.push).toHaveBeenLastCalledWith('/settings/calendar');
  });
});

describe('add to calendar screen', () => {
  it('shows the body and both checkboxes on', async () => {
    await setup();
    expect(
      screen.getByText(
        'Adds your classes from this week to the end of the semester, and your upcoming exams, to your calendar. It’s a copy: if your timetable changes, add it again.',
      ),
    ).toBeTruthy();
    for (const name of ['Classes', 'Exams']) {
      const box = screen.getByRole('checkbox', { name });
      expect(box.props.accessibilityState.checked).toBe(true);
    }
  });

  it('saves an ics with the class and the exam, from this Monday', async () => {
    save.mockReturnValue('downloaded');
    await setup();
    await fireEvent.press(button());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [ics, filename] = save.mock.calls[0];
    expect(filename).toBe('study-planner.ics');
    expect(ics).toContain('SUMMARY:Algebra (seminar)');
    expect(ics).toContain('DTSTART;TZID=Europe/Bucharest:20261102T080000');
    expect(ics).not.toContain('20261026T080000');
    expect(ics).toContain('SUMMARY:Algebra: Final');
  });

  it('leaves exams out when Exams is off', async () => {
    save.mockReturnValue('downloaded');
    await setup();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Exams' }));
    expect(screen.getByRole('checkbox', { name: 'Exams' }).props.accessibilityState.checked).toBe(
      false,
    );
    await fireEvent.press(button());
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [ics] = save.mock.calls[0];
    expect(ics).toContain('Algebra (seminar)');
    expect(ics).not.toContain('Final');
  });

  it('shows the empty copy and disables the button with nothing to export', async () => {
    await setup({});
    expect(screen.getByText(NOTHING)).toBeTruthy();
    expect(button().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button());
    expect(save).not.toHaveBeenCalled();
  });

  it('is empty when both boxes are off', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Classes' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Exams' }));
    expect(screen.getByText(NOTHING)).toBeTruthy();
    expect(button().props.accessibilityState.disabled).toBe(true);
  });

  it('is empty when only exams are on and all are in the past', async () => {
    await setup({ ...data, exams: [{ ...data.exams![0], date: '2026-10-01' }] });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Classes' }));
    expect(screen.getByText(NOTHING)).toBeTruthy();
  });

  it('always shows the help under the buttons', async () => {
    await setup();
    for (const t of [
      'iPhone or iPad: tap Add to calendar, then Add All. When asked which calendar, choose New Calendar and name it “Study Planner”.',
      'Google Calendar: on a computer, create a calendar called “Study Planner” (Settings → Add calendar), then Settings → Import and choose the study-planner.ics file.',
      'To update later, delete the “Study Planner” calendar and add it again.',
    ]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it('shows the download message and clears it when a checkbox changes', async () => {
    save.mockReturnValue('downloaded');
    await setup();
    await fireEvent.press(button());
    const msg = 'Downloaded study-planner.ics. Import it into your calendar as described above.';
    await waitFor(() => expect(screen.getByText(msg)).toBeTruthy());
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Exams' }));
    expect(screen.queryByText(msg)).toBeNull();
  });

  it('shows nothing extra when the calendar opens', async () => {
    save.mockReturnValue('opened');
    await setup();
    await fireEvent.press(button());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.queryByText(/^Downloaded/)).toBeNull();
    expect(screen.queryByText(/^Saved\./)).toBeNull();
  });

  it('Save the file shares and shows the saved message', async () => {
    share.mockResolvedValue('shared');
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Save the file' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Saved. Open the file from where you saved it to add it to your calendar.',
        ),
      ).toBeTruthy(),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('shows no message when the share sheet is cancelled', async () => {
    share.mockResolvedValue('cancelled');
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Save the file' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByText(/^Saved\./)).toBeNull();
    expect(screen.queryByText(/Couldn’t/)).toBeNull();
  });

  it('leaves out an exam from earlier this week', async () => {
    save.mockReturnValue('downloaded');
    await setup({ ...data, exams: [{ ...data.exams![0], date: '2026-11-03' }] });
    await fireEvent.press(button());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).not.toContain('Final');
  });

  it('is empty when the only exam was earlier this week', async () => {
    await setup({ ...data, exams: [{ ...data.exams![0], date: '2026-11-03' }] });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Classes' }));
    expect(screen.getByText(NOTHING)).toBeTruthy();
  });

  it('explains when the device is unsupported', async () => {
    save.mockReturnValue('unsupported');
    await setup();
    await fireEvent.press(button());
    await waitFor(() =>
      expect(
        screen.getByText('On this device, use the web app to export your calendar for now.'),
      ).toBeTruthy(),
    );
  });

  it('shows an error when saving fails', async () => {
    save.mockImplementation(() => {
      throw new Error('boom');
    });
    await setup();
    await fireEvent.press(button());
    await waitFor(() =>
      expect(screen.getByText('Couldn’t create the calendar file. Try again.')).toBeTruthy(),
    );
  });

  it('ignores a second press while saving', async () => {
    let finish: (v: string) => void = () => {};
    share.mockReturnValue(new Promise((r) => (finish = r)));
    const saveBtn = () => screen.getByRole('button', { name: 'Save the file' });
    await setup();
    await fireEvent.press(saveBtn());
    await fireEvent.press(button());
    await fireEvent.press(saveBtn());
    expect(share).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(button().props.accessibilityState.disabled).toBe(true);
    finish('downloaded');
    await waitFor(() => expect(button().props.accessibilityState.disabled).toBe(false));
  });
});
