import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { CompactHeader } from '../../src/ui/CompactHeader';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

describe('CompactHeader', () => {
  it('keeps Back 24px clear of the status bar, where iOS blurs, in a 44px row', async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 62, bottom: 34, left: 0, right: 0 }}>
        <CompactHeader />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    const bar = StyleSheet.flatten(screen.getByTestId('compact-header').props.style);
    // The label sits 12px down a 44px row, so 12px of padding puts its top 24px clear.
    expect(bar).toMatchObject({ paddingTop: 62 + 12, height: 62 + 12 + 44 });
  });
});
