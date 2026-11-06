import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { FormScreen } from '../../src/ui/FormScreen';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const CHOICES = [
  {
    kind: 'timetable',
    label: 'Timetable',
    hint: 'Classes, seminars and labs from the official sheet',
  },
  { kind: 'exams', label: 'Exams', hint: 'The exam session table' },
] as const;

export default function ImportStart() {
  return (
    <FormScreen title="Import">
      <View>
        <Rule weight="heavy" />
        {CHOICES.map(({ kind, label, hint }) => (
          <View key={kind}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${hint}`}
              onPress={() => router.push(`/import/prompt?kind=${kind}`)}
              style={styles.row}
            >
              <View style={styles.text}>
                <Text variant="title">{label}</Text>
                <Text variant="meta">{hint}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Rule weight="hair" />
          </View>
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: theme.space(3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { flex: 1, gap: theme.space(1) },
  chevron: { fontSize: 22, color: theme.color.muted },
});
