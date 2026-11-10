import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { isDate } from '../domain/dates';
import { PickerInput } from './PickerInput';
import { PressScale } from './PressScale';
import { Text } from './Text';
import { TextButton } from './TextButton';
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

type PickerProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  /** An empty value is allowed: the web picker then shows a Clear button. */
  optional?: boolean;
};

/** A real <input type=date|time> on the web (iPhone shows its wheel); the plain Field elsewhere. */
function PickerField({ type, optional, ...p }: PickerProps & { type: 'date' | 'time' }) {
  if (Platform.OS !== 'web') return <Field {...p} />;
  return (
    <View style={styles.field}>
      <Text variant="meta">{p.label}</Text>
      <View style={styles.pickerRow}>
        <PickerInput
          type={type}
          label={p.label}
          value={p.value}
          placeholder={p.placeholder}
          onChangeText={p.onChangeText}
          onBlur={p.onBlur}
          style={[styles.input, styles.webPicker, p.error ? styles.inputError : null]}
        />
        {optional && p.value !== '' ? (
          <TextButton
            label="Clear"
            accessibilityLabel={`Clear ${p.label}`}
            onPress={() => p.onChangeText('')}
          />
        ) : null}
      </View>
      {p.error ? <Text style={styles.error}>{p.error}</Text> : null}
    </View>
  );
}

export function DateField(p: PickerProps) {
  return <PickerField type="date" {...p} />;
}

export function TimeField(p: PickerProps) {
  return <PickerField type="time" {...p} />;
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
            <PressScale
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => (selected && onClear ? onClear() : onChange(o.value))}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{o.label}</Text>
            </PressScale>
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
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  webPicker: { flex: 1, minWidth: 0, boxSizing: 'border-box' } as object,
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
