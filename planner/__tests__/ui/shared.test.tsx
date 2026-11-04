import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { Rule } from '../../src/ui/Rule';
import { useLayout } from '../../src/ui/useLayout';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('Button', () => {
  it('primary is ink filled with paper text', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Save' });
    const s = StyleSheet.flatten(b.props.style);
    expect(s.backgroundColor).toBe('#17213A');
    expect(s.minHeight).toBe(48);
    expect(StyleSheet.flatten(screen.getByText('Save').props.style).color).toBe('#F4F6F8');
    fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('outline has a 2px ink border and transparent fill', async () => {
    await render(<Button kind="outline" label="Sign out" onPress={() => {}} />);
    const s = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(s.borderWidth).toBe(2);
    expect(s.borderColor).toBe('#17213A');
    expect(s.backgroundColor).toBe('transparent');
  });

  it('disabled does not call onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" disabled onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState?.disabled ?? screen.getByRole('button').props['aria-disabled']).toBeTruthy();
  });
});

describe('Rule', () => {
  it('hair is 1px rule colour', async () => {
    await render(<Rule weight="hair" testID="r" />);
    const s = StyleSheet.flatten(screen.getByTestId('r').props.style);
    expect(s.height).toBe(1);
    expect(s.backgroundColor).toBe('#C9CFD8');
  });
  it('heavy is 2px ink', async () => {
    await render(<Rule weight="heavy" testID="r" />);
    const s = StyleSheet.flatten(screen.getByTestId('r').props.style);
    expect(s.height).toBe(2);
    expect(s.backgroundColor).toBe('#17213A');
  });
});

describe('EmptyState', () => {
  it('shows title, body and an action', async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="No homework" body="Nothing due." actionLabel="Add homework" onAction={onAction} />);
    expect(screen.getByText('No homework')).toBeTruthy();
    expect(screen.getByText('Nothing due.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add homework' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('useLayout', () => {
  const at = (width: number) => (useWindowDimensions as jest.Mock).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  it('is phone at 899 and wide at 900', async () => {
    at(899);
    expect((await renderHook(() => useLayout())).result.current).toBe('phone');
    at(900);
    expect((await renderHook(() => useLayout())).result.current).toBe('wide');
  });
});
