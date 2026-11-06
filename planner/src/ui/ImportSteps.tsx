import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

const STEPS = ['Copy the prompt', 'Ask Claude', 'Paste the answer'];

/** The three-step sequence of the import flow, with the current step in ink and the rest muted. */
export function ImportSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View style={styles.list}>
      {STEPS.map((label, i) => (
        <Text
          key={label}
          style={[styles.step, i + 1 === current ? styles.now : styles.later]}
          accessibilityState={{ selected: i + 1 === current }}
        >
          {`${i + 1}. ${label}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space(1) },
  step: { fontFamily: theme.font.appBold },
  now: { color: theme.color.ink },
  later: { color: theme.color.muted },
});
