import React from 'react';
import { fireEvent, render, renderHook, act, screen } from '@testing-library/react-native';
import { NothingToReview } from '../../src/ui/NothingToReview';
import { useSaveLock } from '../../src/ui/useSaveLock';

describe('NothingToReview', () => {
  it('shows the message and goes to import', async () => {
    const onGo = jest.fn();
    await render(<NothingToReview title="Check your exams" onGo={onGo} />);
    expect(screen.getByText('Nothing to review. Start an import from Settings.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to import' }));
    expect(onGo).toHaveBeenCalled();
  });
});

describe('useSaveLock', () => {
  it('runs once while a save is in flight', async () => {
    const { result } = await renderHook(() => useSaveLock());
    let release: () => void = () => undefined;
    const job = jest.fn(() => new Promise<void>((r) => (release = r)));
    await act(async () => {
      void result.current.run(job);
      void result.current.run(job);
    });
    expect(job).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);
    await act(async () => release());
    expect(result.current.saving).toBe(true); // stays locked after success (screen navigates away)
  });

  it('reports a failure and unlocks for a retry', async () => {
    const { result } = await renderHook(() => useSaveLock());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error('x');
      });
    });
    expect(result.current.failed).toBe(true);
    expect(result.current.saving).toBe(false);
    const ok = jest.fn(async () => undefined);
    await act(async () => {
      await result.current.run(ok);
    });
    expect(ok).toHaveBeenCalled();
    expect(result.current.failed).toBe(false);
  });
});
