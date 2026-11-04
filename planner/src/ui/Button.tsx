import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'outline';
  disabled?: boolean;
}

export function Button({ label, onPress, kind = 'primary', disabled = false }: ButtonProps) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.base,
        primary ? styles.primary : styles.outline,
        disabled && (primary ? styles.primaryDisabled : styles.outlineDisabled),
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: primary ? theme.color.paper : theme.color.ink },
          disabled && !primary && styles.mutedLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
  },
  primary: { backgroundColor: theme.color.ink },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.color.ink },
  primaryDisabled: { backgroundColor: theme.color.muted },
  outlineDisabled: { borderColor: theme.color.muted },
  label: { fontFamily: theme.font.appBold },
  mutedLabel: { color: theme.color.muted },
});
