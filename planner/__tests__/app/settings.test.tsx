import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Settings from '../../app/settings/index';
import { useAuth } from '../../src/data/auth';

jest.mock('../../src/data/auth', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('settings index', () => {
  it('lists rows that navigate, and signs out', async () => {
    const signOut = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ signOut });
    await render(<Settings />);
    expect(screen.getByText('Settings')).toBeTruthy();
    const targets: Record<string, string> = {
      Semester: '/settings/semester',
      Subjects: '/settings/subjects',
      Exams: '/exams',
      Backup: '/settings/backup',
    };
    for (const [label, href] of Object.entries(targets)) {
      fireEvent.press(screen.getByRole('button', { name: label }));
      expect(router.push).toHaveBeenLastCalledWith(href);
    }
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});
