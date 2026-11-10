import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { CompactHeader } from '../../src/ui/CompactHeader';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

describe('CompactHeader', () => {
  it('puts Back just under the status bar, in a 44px row', async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={{ top: 62, bottom: 34, left: 0, right: 0 }}>
        <CompactHeader />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    const bar = StyleSheet.flatten(screen.getByTestId('compact-header').props.style);
    expect(bar).toMatchObject({ paddingTop: 62, height: 62 + 44 });
  });
});
