import { View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

export default function Today() {
  return (
    <View style={{ flex: 1, padding: theme.space(4), backgroundColor: theme.color.paper }}>
      <Text variant="title">Today</Text>
    </View>
  );
}
