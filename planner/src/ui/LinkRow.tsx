import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Link } from '../domain/types';
import { openLink } from './openLink';
import { Rule } from './Rule';
import { Text } from './Text';
import { TextButton } from './TextButton';
import { theme } from './theme';

export function LinkRow({ link }: { link: Link }) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={link.title}
          onPress={() => openLink(link.url)}
          onLongPress={() => router.push(`/link/edit?id=${link.id}`)}
          style={styles.open}
        >
          <Text style={styles.title}>{link.title}</Text>
          <Text style={styles.arrow}>↗</Text>
        </Pressable>
        <TextButton
          label="Edit"
          accessibilityLabel={`Edit ${link.title}`}
          onPress={() => router.push(`/link/edit?id=${link.id}`)}
        />
      </View>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    minHeight: 48,
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  title: { flex: 1 },
  arrow: { fontFamily: theme.font.appBold, paddingHorizontal: theme.space(2) },
});
