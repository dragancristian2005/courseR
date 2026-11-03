import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../data/auth';
import { useStore } from '../data/useStore';
import { Text } from './Text';
import { theme } from './theme';

/** Shows nothing until the store has delivered, and an error screen if it could not load. */
export function StoreGate({ children }: { children: React.ReactNode }) {
  const { ready, error } = useStore();
  const { signOut } = useAuth();

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text variant="title">Your data couldn’t load</Text>
          <Text>Check your connection, then sign out and sign in again.</Text>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.button}>
            <Text style={styles.label}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return ready ? <>{children}</> : null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space(6),
    backgroundColor: theme.color.paper,
  },
  card: { width: '100%', maxWidth: 420, gap: theme.space(4) },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
    backgroundColor: theme.color.ink,
  },
  label: { color: theme.color.paper, fontFamily: theme.font.appBold },
});
