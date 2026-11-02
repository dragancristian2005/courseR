import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

describe('Text', () => {
  it('time variant uses tabular figures', async () => {
    await render(<Text variant="time">09:00</Text>);
    const style = StyleSheet.flatten(screen.getByText('09:00').props.style);
    expect(style.fontVariant).toContain('tabular-nums');
  });

  it('note variant uses the note font', async () => {
    await render(<Text variant="note">hello</Text>);
    const style = StyleSheet.flatten(screen.getByText('hello').props.style);
    expect(style.fontFamily).toBe(theme.font.note);
  });
});
