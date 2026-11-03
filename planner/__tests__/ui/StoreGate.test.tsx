import React from 'react';
import { Text as RNText } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../../src/data/auth';
import { createMemoryRepository } from '../../src/data/memoryRepository';
import { StoreProvider } from '../../src/data/StoreProvider';
import type { Repository } from '../../src/data/repository';
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
    expect(screen.getByText('Check your connection, then sign out and sign in again.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sign out'));
    expect(signOut).toHaveBeenCalled();
  });
});
