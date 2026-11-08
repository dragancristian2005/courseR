import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useAuth } from '../data/auth';
import { useStore } from '../data/useStore';
import { Button } from './Button';
import { Text } from './Text';
import { TextButton } from './TextButton';
import { theme } from './theme';

const BANNER_PAD = theme.space(2);

/** Shows nothing until the store has delivered, and an error screen if it could not load. */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const { ready, error, writeError, dismissWriteError } = useStore();
  const { signOut } = useAuth();
  // The context read (not useSafeAreaInsets) tolerates a missing provider, e.g. in unit tests.
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text variant="title">Your data couldn’t load</Text>
          <Text>Check your connection, then sign out and sign in again.</Text>
          <Button label="Sign out" onPress={() => void signOut()} />
        </View>
      </View>
    );
  }
  if (!ready) return null;
  return (
    <View style={styles.shell}>
      {writeError ? (
        <View
          accessibilityRole="alert"
          style={[styles.banner, { paddingTop: BANNER_PAD + topInset }]}
        >
          <Text style={styles.bannerText}>
            A change didn’t sync because a newer version exists. Your app shows the latest.
          </Text>
          <TextButton label="Dismiss" onPress={dismissWriteError} />
        </View>
      ) : null}
      <View style={styles.shell}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: BANNER_PAD,
    backgroundColor: theme.color.paper,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.ink,
  },
  bannerText: { flex: 1 },
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space(6),
    backgroundColor: theme.color.paper,
  },
  card: { width: '100%', maxWidth: 420, gap: theme.space(4) },
});
