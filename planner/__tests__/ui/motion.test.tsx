import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useReducedMotion } from '../../src/ui/motion';

function Probe() {
  const reduced = useReducedMotion();
  return <Text>{reduced ? 'reduced' : 'full'}</Text>;
}

describe('useReducedMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('follows the system setting and its changes', async () => {
    let listener: (v: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _e: string,
      fn: (v: boolean) => void,
    ) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as never);
    await render(<Probe />);
    expect(await screen.findByText('reduced')).toBeTruthy();
    await act(async () => listener(false));
    expect(screen.getByText('full')).toBeTruthy();
  });
});
