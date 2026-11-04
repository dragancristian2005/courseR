import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme } from './theme';

/** `lead` is the bold part of the link line (the abbreviation), `rest` the muted remainder. */
export function NoteRow({
  id,
  lead,
  rest,
  age,
  text,
}: {
  id: string;
  lead?: string;
  rest: string;
  age: string;
  text: string;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit note: ${text}`}
        onPress={() => router.push(`/note/edit?id=${id}`)}
        style={styles.row}
      >
        <View style={styles.head}>
          <Text variant="meta" style={styles.line}>
            {lead ? (
              <Text variant="meta" style={styles.lead}>
                {lead}
              </Text>
            ) : null}
            {rest}
          </Text>
          <Text variant="meta">{age}</Text>
        </View>
        <Text variant="note" testID="note-text">
          {text}
        </Text>
      </Pressable>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingVertical: theme.space(3), gap: theme.space(1) },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space(3),
  },
  line: { flex: 1 },
  lead: { fontFamily: theme.font.appBold, color: theme.color.ink },
});
