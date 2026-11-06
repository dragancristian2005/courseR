import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { theme } from './theme';

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.box}>
      <Text variant="title">{title}</Text>
      <Text>{body}</Text>
      <Button label={actionLabel} onPress={onAction} />
      {secondaryLabel ? (
        <Button kind="outline" label={secondaryLabel} onPress={onSecondary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: theme.space(3), padding: theme.space(4), alignItems: 'flex-start' },
});
