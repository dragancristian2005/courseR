import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { downloadText, pickTextFile } from '../../src/data/backupFile';
import { useStore } from '../../src/data/useStore';
import { exportBackup, parseBackup } from '../../src/domain/backup';
import { todayISO } from '../../src/domain/dates';
import type { PlannerData } from '../../src/domain/types';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

export default function Backup() {
  const { data, repo, ready, error: loadError } = useStore();
  const blocked = !ready || loadError !== null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PlannerData | null>(null);
  const [restored, setRestored] = useState(false);

  const download = () => {
    if (blocked) return;
    setError(null);
    setRestored(false);
    try {
      downloadText(`study-planner-backup-${todayISO()}.json`, exportBackup(data, new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backup could not be downloaded.');
    }
  };

  const restore = async () => {
    if (blocked) return;
    setError(null);
    setRestored(false);
    setPending(null);
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const result = parseBackup(text);
      if (result.ok) setPending(result.data);
      else setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be read.');
    }
  };

  const replace = async () => {
    if (!pending || blocked) return;
    const next = pending;
    setPending(null);
    try {
      await repo.replaceAll(next);
      setRestored(true);
    } catch {
      setError('The backup could not be restored. Try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text variant="title">Backup</Text>
        <Text>
          Download a copy of everything in your account, or restore one you saved earlier.
        </Text>
        {loadError ? (
          <Text style={styles.error}>Backups need your data to load first.</Text>
        ) : !ready ? (
          <Text variant="meta">Loading your data…</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={download}
          style={[styles.primary, blocked && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>Download backup</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={() => void restore()}
          style={[styles.secondary, blocked && styles.disabled]}
        >
          <Text style={styles.secondaryLabel}>Restore from backup</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {restored ? <Text>Backup restored.</Text> : null}
        {pending ? (
          <View style={styles.confirm}>
            <Text>This replaces everything in your account with the backup. Continue?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void replace()}
              style={styles.primary}
            >
              <Text style={styles.primaryLabel}>Replace everything</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPending(null)}
              style={styles.secondary}
            >
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    padding: theme.space(6),
    backgroundColor: theme.color.paper,
  },
  card: { width: '100%', maxWidth: 420, gap: theme.space(4) },
  confirm: {
    gap: theme.space(3),
    padding: theme.space(4),
    borderWidth: 1,
    borderColor: theme.color.rule,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
    backgroundColor: theme.color.ink,
  },
  primaryLabel: { color: theme.color.paper, fontFamily: theme.font.appBold },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
    borderWidth: 1,
    borderColor: theme.color.ink,
  },
  secondaryLabel: { color: theme.color.ink, fontFamily: theme.font.appBold },
  disabled: { opacity: 0.5 },
  error: { color: theme.color.now },
});
