import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';
import { useLayout } from '../../src/ui/useLayout';

export default function Today() {
  const layout = useLayout();
  return (
    <View style={{ flex: 1, padding: theme.space(4), backgroundColor: theme.color.paper }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title">Today</Text>
        {layout === 'phone' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}
          >
            <Text style={{ fontFamily: theme.font.appBold }}>Settings</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
