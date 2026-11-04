import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BackLink() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={goBack}
      style={styles.link}
    >
      <Text style={styles.label}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space(2),
  },
  label: { fontFamily: theme.font.app, color: theme.color.ink },
});
