import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackLink } from '../../src/ui/BackLink';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

describe('BackLink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('goes back when there is history', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    await render(<BackLink />);
    expect(screen.getByText('‹ Back')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces to / when there is no history', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    await render(<BackLink />);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});
