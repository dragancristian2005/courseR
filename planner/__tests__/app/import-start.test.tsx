import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportStart from '../../app/import/index';
import ImportPrompt from '../../app/import/prompt';
import ImportPaste from '../../app/import/paste';
import Settings from '../../app/settings/index';
import { SetupPrompt } from '../../src/ui/SetupPrompt';
import { copyText, readText } from '../../src/data/clipboard';
import { clearPending, getPending, setPending } from '../../src/data/importSession';
import { openLink } from '../../src/ui/openLink';
import {
  buildPrompt,
  EXAMS_EXAMPLE,
  PROMPT_FIRST_LINE_TIMETABLE,
  TIMETABLE_EXAMPLE,
} from '../../src/domain/importPrompt';
import type { PlannerData } from '../../src/domain/types';

let mockParams: { kind?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../../src/data/auth', () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock('../../src/data/clipboard', () => ({ copyText: jest.fn(), readText: jest.fn() }));
jest.mock('../../src/ui/openLink', () => ({ openLink: jest.fn() }));

const myTimetable = { ...TIMETABLE_EXAMPLE, title: 'My own timetable' };
const myExams = { ...EXAMS_EXAMPLE, groups: [...EXAMS_EXAMPLE.groups, 'Z9'] };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  clearPending();
});

describe('import start', () => {
  it('routes each kind to the prompt screen', async () => {
    await render(<ImportStart />);
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getByText('Classes, seminars and labs from the official sheet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Timetable/ }));
    expect(router.push).toHaveBeenLastCalledWith('/import/prompt?kind=timetable');
    await fireEvent.press(screen.getByRole('button', { name: /Exams/ }));
    expect(router.push).toHaveBeenLastCalledWith('/import/prompt?kind=exams');
  });
});

describe('import prompt', () => {
  it('copies the prompt, confirms for 3 seconds, opens Claude and moves on', async () => {
    (copyText as jest.Mock).mockResolvedValue(true);
    mockParams = { kind: 'exams' };
    await render(<ImportPrompt />);
    jest.useFakeTimers();
    expect(screen.getByText('1. Copy the prompt')).toBeTruthy();
    expect(screen.getByText(/attach a photo or PDF of your exam schedule/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(copyText).toHaveBeenCalledWith(buildPrompt('exams'));
    expect(screen.getByText('Prompt copied.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Prompt copied.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Claude' }));
    expect(openLink).toHaveBeenCalledWith('https://claude.ai/new');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: paste the answer' }));
    expect(router.push).toHaveBeenLastCalledWith('/import/paste?kind=exams');
    jest.useRealTimers();
  });

  it('shows a fallback when copying fails, and reveals the prompt on request', async () => {
    (copyText as jest.Mock).mockResolvedValue(false);
    mockParams = { kind: 'bogus' };
    await render(<ImportPrompt />);
    expect(screen.getByText(/your timetable/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(
      screen.getByText('Couldn’t copy. Open “Show the prompt” and copy it by hand.'),
    ).toBeTruthy();
    expect(screen.queryByText(PROMPT_FIRST_LINE_TIMETABLE, { exact: false })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show the prompt' }));
    expect(screen.getByText(buildPrompt('timetable'))).toBeTruthy();
  });
});

describe('import paste', () => {
  const answer = async (text: string) => {
    await fireEvent.changeText(screen.getByLabelText('Claude’s answer'), text);
    await fireEvent.press(screen.getByRole('button', { name: 'Check answer' }));
  };

  it('disables Check answer while empty', async () => {
    await render(<ImportPaste />);
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled();
  });

  it('shows the parse error for junk', async () => {
    await render(<ImportPaste />);
    await answer('hello there');
    expect(screen.getByTestId('paste-error')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(getPending()).toBeNull();
  });

  it('refuses the pasted prompt itself', async () => {
    await render(<ImportPaste />);
    await answer(`  ${buildPrompt('timetable')}`);
    expect(
      screen.getByText(
        'That’s the prompt, not Claude’s answer. Send it to Claude first, then copy Claude’s reply.',
      ),
    ).toBeTruthy();
  });

  it('stores a valid timetable and goes to review', async () => {
    mockParams = { kind: 'timetable' };
    await render(<ImportPaste />);
    await answer('Here you go:\n```json\n' + JSON.stringify(myTimetable) + '\n```');
    expect(getPending()).toMatchObject({ kind: 'timetable' });
    expect(router.push).toHaveBeenLastCalledWith('/import/review');
  });

  it('stores valid exams and goes to the exams check', async () => {
    mockParams = { kind: 'exams' };
    await render(<ImportPaste />);
    await answer(JSON.stringify(myExams));
    expect(getPending()).toMatchObject({ kind: 'exams' });
    expect(router.push).toHaveBeenLastCalledWith('/import/exams');
  });

  it('rejects the example from the prompt, for both kinds', async () => {
    const msg =
      'That’s the example from the prompt, not your timetable. Make sure the photo or PDF was attached, then ask Claude again.';
    mockParams = { kind: 'timetable' };
    const { unmount } = await render(<ImportPaste />);
    await answer(JSON.stringify(TIMETABLE_EXAMPLE));
    expect(screen.getByText(msg)).toBeTruthy();
    expect(getPending()).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    await unmount();
    mockParams = { kind: 'exams' };
    await render(<ImportPaste />);
    await answer(JSON.stringify(EXAMS_EXAMPLE));
    expect(screen.getByText(msg)).toBeTruthy();
    expect(getPending()).toBeNull();
  });

  it('turns off spell check on the answer field', async () => {
    await render(<ImportPaste />);
    expect(screen.getByLabelText('Claude’s answer').props.spellCheck).toBe(false);
  });

  it('flags the wrong kind', async () => {
    mockParams = { kind: 'exams' };
    await render(<ImportPaste />);
    await answer(JSON.stringify(TIMETABLE_EXAMPLE));
    expect(
      screen.getByText('This is a timetable import. Go back and choose Timetable.'),
    ).toBeTruthy();
    expect(getPending()).toBeNull();
  });

  it('pastes from the clipboard, replacing the field, or says it is empty', async () => {
    await render(<ImportPaste />);
    await fireEvent.changeText(screen.getByLabelText('Claude’s answer'), 'old');
    (readText as jest.Mock).mockResolvedValueOnce('new text');
    await fireEvent.press(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(screen.getByLabelText('Claude’s answer').props.value).toBe('new text');
    (readText as jest.Mock).mockResolvedValueOnce('  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(screen.getByText('The clipboard is empty. Copy Claude’s answer first.')).toBeTruthy();
  });

  it('says so, and keeps the field, when the clipboard cannot be read', async () => {
    await render(<ImportPaste />);
    await fireEvent.changeText(screen.getByLabelText('Claude’s answer'), 'old');
    (readText as jest.Mock).mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(
      screen.getByText('Couldn’t read the clipboard. Paste into the box by hand.'),
    ).toBeTruthy();
    expect(screen.queryByText('The clipboard is empty. Copy Claude’s answer first.')).toBeNull();
    expect(screen.getByLabelText('Claude’s answer').props.value).toBe('old');
  });
});

describe('entry points', () => {
  it('settings rows start each import', async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Import timetable' }));
    expect(router.push).toHaveBeenLastCalledWith('/import/prompt?kind=timetable');
    await fireEvent.press(screen.getByRole('button', { name: 'Import exams' }));
    expect(router.push).toHaveBeenLastCalledWith('/import/prompt?kind=exams');
  });

  it('settings rows drop a file left over from an earlier import', async () => {
    await render(<Settings />);
    setPending(myTimetable as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Import timetable' }));
    expect(getPending()).toBeNull();
    setPending(myExams as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Import exams' }));
    expect(getPending()).toBeNull();
  });

  it('setup prompts offer Import from a photo in both states', async () => {
    const empty = { semester: null, patterns: [] } as unknown as PlannerData;
    const { unmount } = await render(<SetupPrompt data={empty} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Import from a photo' }));
    expect(router.push).toHaveBeenLastCalledWith('/import');
    await unmount();
    const noClasses = { semester: { id: 's' }, patterns: [] } as unknown as PlannerData;
    await render(<SetupPrompt data={noClasses} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Import from a photo' }));
    expect(router.push).toHaveBeenLastCalledWith('/import');
  });
});
