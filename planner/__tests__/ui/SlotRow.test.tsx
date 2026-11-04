import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SlotRow } from '../../src/ui/SlotRow';

const base = { start: '08:00', end: '09:30', title: 'ITB', type: 'lab' as const, room: '032' };

describe('SlotRow', () => {
  it('fills the cell with the type colour and labels it', async () => {
    await render(<SlotRow {...base} subtitle="Dr. Pop" />);
    const cell = screen.getByLabelText('ITB, lab, 08:00 to 09:30, room 032');
    expect(StyleSheet.flatten(cell.props.style).backgroundColor).toBe('#BFE3DA');
    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('09:30')).toBeTruthy();
    expect(screen.getByText('Dr. Pop')).toBeTruthy();
  });

  it('omits room from the label when absent', async () => {
    await render(<SlotRow {...base} room={undefined} />);
    expect(screen.getByLabelText('ITB, lab, 08:00 to 09:30')).toBeTruthy();
  });

  it('is a button only when pressable', async () => {
    const onPress = jest.fn();
    await render(<SlotRow {...base} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('draws no now line by default', async () => {
    await render(<SlotRow {...base} />);
    expect(screen.queryByTestId('slot-now-line')).toBeNull();
  });

  it('draws the red now line and time tag', async () => {
    await render(<SlotRow {...base} now nowTime="08:45" />);
    const line = screen.getByTestId('slot-now-line');
    const s = StyleSheet.flatten(line.props.style);
    expect(s.backgroundColor).toBe('#C8302A');
    expect(s.height).toBe(2);
    expect(s.top).toBe('50%');
    const tag = screen.getByText('08:45');
    expect(StyleSheet.flatten(tag.props.style).color).toBe('#F4F6F8');
  });

  it('clamps the now line and defaults to the middle', async () => {
    const { rerender } = await render(<SlotRow {...base} now nowTime="12:00" />);
    expect(StyleSheet.flatten(screen.getByTestId('slot-now-line').props.style).top).toBe('100%');
    await rerender(<SlotRow {...base} now nowTime="07:00" />);
    expect(StyleSheet.flatten(screen.getByTestId('slot-now-line').props.style).top).toBe('0%');
    await rerender(<SlotRow {...base} now />);
    expect(StyleSheet.flatten(screen.getByTestId('slot-now-line').props.style).top).toBe('50%');
  });
});
