import { View, type ViewProps } from 'react-native';
import { theme } from './theme';

export function Rule({
  weight = 'hair',
  style,
  ...rest
}: ViewProps & { weight?: 'hair' | 'heavy' }) {
  const heavy = weight === 'heavy';
  return (
    <View
      {...rest}
      style={[
        { height: heavy ? 2 : 1, backgroundColor: heavy ? theme.color.ink : theme.color.rule },
        style,
      ]}
    />
  );
}
