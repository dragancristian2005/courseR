import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { theme } from './theme';

/**
 * The question after a class is dropped somewhere new on the Week tab: move it just this week or
 * every week. With a warning, it asks to confirm an every-week change first.
 */
export function DropBar({
  question,
  warning,
  failure,
  onThisWeek,
  onEveryWeek,
  onCancel,
  onSaveAnyway,
  onGoBack,
}: {
  question: string;
  warning?: string;
  failure?: string;
  onThisWeek: () => void;
  /** Left out when the class can only be moved this week. */
  onEveryWeek?: () => void;
  onCancel: () => void;
  onSaveAnyway: () => void;
  onGoBack: () => void;
}) {
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.question}>{warning ?? question}</Text>
      {failure ? <Text style={styles.error}>{failure}</Text> : null}
      {warning ? (
        <View style={styles.buttons}>
          <Button label="Save anyway" onPress={onSaveAnyway} />
          <Button label="Go back" kind="outline" onPress={onGoBack} />
        </View>
      ) : (
        <View style={styles.buttons}>
          <Button label="Just this week" onPress={onThisWeek} />
          {onEveryWeek ? <Button label="Every week" kind="outline" onPress={onEveryWeek} /> : null}
          <Button label="Cancel" kind="outline" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: theme.space(3),
    padding: theme.space(4),
    borderTopWidth: 2,
    borderTopColor: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  question: { fontFamily: theme.font.appBold, fontSize: 16, color: theme.color.ink },
  error: { color: theme.color.now, fontFamily: theme.font.appBold },
  buttons: { flexDirection: 'row', gap: theme.space(2), flexWrap: 'wrap' },
});
