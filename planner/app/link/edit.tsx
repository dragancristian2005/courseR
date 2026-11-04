import { View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

export default function Screen() {
  return (
    <View style={{ flex: 1, padding: theme.space(4), backgroundColor: theme.color.paper }}>
      <Text variant="title">Edit link</Text>
    </View>
  );
}
