import { unstable_createElement } from 'react-native-web';
import type { PickerInputProps } from './PickerInput';

const Input = (props: Record<string, unknown>) => unstable_createElement('input', props);

export function PickerInput({
  type,
  label,
  value,
  placeholder,
  onChangeText,
  onBlur,
  style,
}: PickerInputProps) {
  const report = (e: { target: { value: string } }) => onChangeText(e.target.value);
  return (
    <Input
      type={type}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={report}
      onInput={report}
      onBlur={onBlur}
      style={[style, { appearance: 'none', WebkitAppearance: 'none', textAlign: 'left' }]}
    />
  );
}
