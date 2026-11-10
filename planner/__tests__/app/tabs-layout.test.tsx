import React from 'react';
import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import TabLayout from '../../app/(tabs)/_layout';
import { tabBarBottomPad } from '../../src/ui/tabBar';
import { theme } from '../../src/ui/theme';
import { useLayout } from '../../src/ui/useLayout';

jest.mock('../../src/ui/useLayout', () => ({ useLayout: jest.fn() }));

const page = (name: string) => () => <Text>{`page ${name}`}</Text>;
const routes = {
  '(tabs)/_layout': TabLayout,
  '(tabs)/index': page('today'),
  '(tabs)/week': page('week'),
  '(tabs)/homework': page('homework'),
  '(tabs)/notes': page('notes'),
  '(tabs)/links': page('links'),
  'settings/index': page('settings'),
};
const labels = ['Today', 'Week', 'Homework', 'Notes', 'Links'];

describe('tabs layout', () => {
  it('phone: bottom tab bar with text labels and no Settings', async () => {
    (useLayout as jest.Mock).mockReturnValue('phone');
    await renderRouter(routes, { initialUrl: '/' });
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.queryByText('Settings')).toBeNull();
    expect(screen.getAllByRole('tab')[0].parent?.props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByText('page today')).toBeTruthy();
  });

  it('wide: sidebar with the labels plus Settings, which navigates to /settings', async () => {
    (useLayout as jest.Mock).mockReturnValue('wide');
    await renderRouter(routes, { initialUrl: '/' });
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByLabelText('Sidebar')).toBeTruthy();
    expect(screen.getAllByRole('tab')[0].parent?.props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    await fireEvent.press(screen.getByText('Week'));
    expect(await screen.findByText('page week')).toBeTruthy();
    await fireEvent.press(screen.getByText('Settings'));
    expect(await screen.findByText('page settings')).toBeTruthy();
  });

  it('phone: the active tab is a light pill on the dark floating bar', async () => {
    (useLayout as jest.Mock).mockReturnValue('phone');
    await renderRouter(routes, { initialUrl: '/' });
    const [today, week] = screen.getAllByRole('tab');
    expect(StyleSheet.flatten(today.props.style).backgroundColor).toBe(theme.color.paper);
    expect(StyleSheet.flatten(week.props.style).backgroundColor).toBeUndefined();
    const bar = today.parent!;
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({
      backgroundColor: theme.color.ink,
      borderRadius: expect.any(Number),
    });
  });
});

describe('tabBarBottomPad', () => {
  it('floats the bar clearly above the iPhone home indicator', () => {
    expect(tabBarBottomPad(34)).toBe(46);
  });
  it('keeps a gap on screens without a home indicator', () => {
    expect(tabBarBottomPad(0)).toBe(16);
  });
});
