import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { isDate } from '../domain/dates';
import { Text } from './Text';
import { theme } from './theme';

export const MSG_TIME = 'Enter a time like 09:40.';
export const MSG_ORDER = 'The class must end after it starts.';
export const MSG_DATE = 'Enter a date like 2026-11-09.';

export function isTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export { isDate };

export function timeErrors(start: string, end: string): { start?: string; end?: string } {
  const out: { start?: string; end?: string } = {};
  if (!isTime(start)) out.start = MSG_TIME;
  if (!isTime(end)) out.end = MSG_TIME;
  else if (isTime(start) && end <= start) out.end = MSG_ORDER;
  return out;
}

export function Field({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View style={styles.field}>
      <Text variant="meta">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.color.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  onClear,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  /** When given, tapping the selected chip again clears the choice. */
  onClear?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text variant="meta">{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => (selected && onClear ? onClear() : onChange(o.value))}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  field: { gap: theme.space(1) },
  input: {
    minHeight: 44,
    borderWidth: 2,
    borderColor: theme.color.ink,
    paddingHorizontal: theme.space(3),
    fontFamily: theme.font.app,
    fontSize: 16,
    color: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  inputError: { borderColor: theme.color.now },
  error: {
    color: theme.color.now,
    fontFamily: theme.font.appBold,
    fontSize: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: theme.space(3),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  chipOn: { backgroundColor: theme.color.ink },
  chipText: { fontFamily: theme.font.appBold },
  chipTextOn: { color: theme.color.paper },
});
