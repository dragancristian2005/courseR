import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/data/auth';
import { clearPending } from '../../src/data/importSession';
import { Button } from '../../src/ui/Button';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const ROWS: { label: string; href: Href; startsImport?: boolean }[] = [
  { label: 'Semester', href: '/settings/semester' },
  { label: 'Subjects', href: '/settings/subjects' },
  { label: 'Exams', href: '/exams' },
  { label: 'Import timetable', href: '/import/prompt?kind=timetable', startsImport: true },
  { label: 'Import exams', href: '/import/prompt?kind=exams', startsImport: true },
  { label: 'Backup', href: '/settings/backup' },
];

export default function Settings() {
  const { signOut } = useAuth();
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <Text variant="title" accessibilityRole="header">
          Settings
        </Text>
        <View>
          <Rule weight="hair" />
          {ROWS.map(({ label, href, startsImport }) => (
            <View key={label}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => {
                  // Every import starts fresh, even when this skips the import start screen.
                  if (startsImport) clearPending();
                  router.push(href);
                }}
                style={styles.row}
              >
                <Text>{label}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <Rule weight="hair" />
            </View>
          ))}
        </View>
        <Button kind="outline" label="Sign out" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: theme.space(4), backgroundColor: theme.color.paper },
  column: { width: '100%', maxWidth: 520, gap: theme.space(4) },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevron: { fontSize: 22, color: theme.color.muted },
});
