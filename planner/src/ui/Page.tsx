import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme } from './theme';

/** Scrolling page body with the standard width limit. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

/** Title left, primary action right, closed by a heavy rule. */
export function PageHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Button label={actionLabel} onPress={onAction} />
      </View>
      <Rule weight="heavy" />
    </View>
  );
}

export function SectionHeading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.paper },
  content: {
    padding: theme.space(4),
    alignItems: 'center',
    paddingBottom: theme.space(8),
  },
  inner: { width: '100%', maxWidth: 720, gap: theme.space(2) },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space(3),
    paddingBottom: theme.space(2),
  },
  title: {
    fontFamily: theme.font.appBold,
    fontSize: 30,
    color: theme.color.ink,
  },
  heading: {
    fontFamily: theme.font.appBold,
    fontSize: 17,
    color: theme.color.ink,
    paddingTop: theme.space(4),
    paddingBottom: theme.space(1),
  },
});
