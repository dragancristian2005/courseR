import type { StyleProp, ViewStyle } from 'react-native';

export type PickerInputProps = {
  type: 'date' | 'time';
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  style: StyleProp<ViewStyle>;
};

/** Native: unused. The web build swaps in PickerInput.web.tsx, so react-native-web stays out of here. */
export function PickerInput(_props: PickerInputProps): null {
  return null;
}
