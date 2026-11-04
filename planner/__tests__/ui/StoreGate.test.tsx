import React from 'react';
import { Text as RNText } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../../src/data/auth';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import { emptyPlannerData, type Repository } from '../../src/data/repository';
import { StoreGate } from '../../src/ui/StoreGate';

jest.mock('../../src/data/auth', () => ({ useAuth: jest.fn() }));

describe('StoreGate', () => {
  it('renders children when ready', async () => {
    (useAuth as jest.Mock).mockReturnValue({ signOut: jest.fn() });
    await render(
      <StoreProvider repository={createMemoryRepository()}>
        <StoreGate>
          <RNText>content</RNText>
        </StoreGate>
      </StoreProvider>,
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('shows the error screen when the repository fails, and signs out', async () => {
    const signOut = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ signOut });
    const repo: Repository = {
      ...createMemoryRepository(),
      subscribe(_cb, onError) {
        onError!(new Error('permission-denied'));
        return () => {};
      },
    };
    await render(
      <StoreProvider repository={repo}>
        <StoreGate>
          <RNText>content</RNText>
        </StoreGate>
      </StoreProvider>,
    );
    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Your data couldn’t load')).toBeTruthy();
    expect(
      screen.getByText('Check your connection, then sign out and sign in again.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Sign out'));
    expect(signOut).toHaveBeenCalled();
  });

  it('shows a dismissable banner, not the error screen, when a write is rejected', async () => {
    (useAuth as jest.Mock).mockReturnValue({ signOut: jest.fn() });
    let rejectWrite: (e: Error) => void = () => {};
    const repo: Repository = {
      ...createMemoryRepository(),
      subscribe(cb, _onError, onWriteError) {
        cb(emptyPlannerData());
        rejectWrite = onWriteError!;
        return () => {};
      },
    };
    await render(
      <StoreProvider repository={repo}>
        <StoreGate>
          <RNText>content</RNText>
        </StoreGate>
      </StoreProvider>,
    );
    expect(screen.queryByText('A change didn’t sync', { exact: false })).toBeNull();
    await act(async () => {
      rejectWrite(new Error('permission-denied'));
    });
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.queryByText('Your data couldn’t load')).toBeNull();
    expect(
      screen.getByText(
        'A change didn’t sync because a newer version exists. Your app shows the latest.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Dismiss'));
    expect(screen.queryByText('Dismiss')).toBeNull();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
