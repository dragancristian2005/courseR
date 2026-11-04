import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/data/auth';
import { Text } from '../src/ui/Text';
import { theme } from '../src/ui/theme';

export default function SignIn() {
  const { signIn, configError, redirectFailed } = useAuth();
  const [failed, setFailed] = useState(false);

  const onPress = async () => {
    setFailed(false);
    try {
      await signIn();
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text variant="title">Your timetable, on every device</Text>
        <Text style={styles.body}>
          Sign in to keep your classes, homework and notes in sync on your phone, iPad and laptop.
        </Text>
        {configError ? (
          <Text style={styles.error}>{configError}</Text>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
              <Text style={styles.buttonLabel}>Sign in with Google</Text>
            </Pressable>
            {failed || redirectFailed ? (
              <Text style={styles.error}>Sign-in didn’t finish. Try again.</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
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
  body: { color: theme.color.ink },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
    backgroundColor: theme.color.ink,
  },
  buttonLabel: { color: theme.color.paper, fontFamily: theme.font.appBold },
  error: { color: theme.color.now },
});
