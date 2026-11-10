import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { Homework, ISODate, Subject } from '../domain/types';
import { dueLabel } from '../domain/selectors';
import { NATIVE_DRIVER, useReducedMotion } from './motion';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme } from './theme';

const URGENT = ['Overdue', 'Today', 'Tomorrow'];

export function HomeworkRow({
  hw,
  subject,
  today,
  onToggle,
}: {
  hw: Homework;
  subject: Subject | undefined;
  today: ISODate;
  onToggle: () => void;
}) {
  const label = dueLabel(hw.due, today);
  const reduced = useReducedMotion();
  // Ticking a homework off pops the box once; un-ticking doesn't.
  const pop = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(hw.done);
  useEffect(() => {
    if (hw.done && !wasDone.current && !reduced) {
      pop.setValue(0.7);
      Animated.spring(pop, {
        toValue: 1,
        useNativeDriver: NATIVE_DRIVER,
        speed: 14,
        bounciness: 14,
      }).start();
    }
    wasDone.current = hw.done;
  }, [hw.done, reduced, pop]);
  const sub = [subject?.name, hw.dueTime].filter(Boolean).join(', ');
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${hw.title}, ${hw.done ? 'done' : 'not done'}`}
          accessibilityState={{ checked: hw.done }}
          onPress={onToggle}
          style={styles.hit}
        >
          <Animated.View
            testID="homework-box"
            style={[styles.box, hw.done && styles.boxOn, { transform: [{ scale: pop }] }]}
          >
            {hw.done ? <Text style={styles.tick}>✓</Text> : null}
          </Animated.View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${hw.title}`}
          onPress={() => router.push(`/homework/edit?id=${hw.id}`)}
          style={styles.body}
        >
          <View style={styles.main}>
            <Text style={hw.done && styles.doneText}>{hw.title}</Text>
            {sub ? <Text variant="meta">{sub}</Text> : null}
          </View>
          {label ? (
            <Text style={URGENT.includes(label) && !hw.done ? styles.urgent : styles.due}>
              {label}
            </Text>
          ) : null}
        </Pressable>
      </View>
      <Rule />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: theme.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: theme.color.ink },
  tick: {
    color: theme.color.paper,
    fontSize: 14,
    lineHeight: 16,
    fontFamily: theme.font.appBold,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(3),
    minHeight: 56,
    paddingLeft: theme.space(2),
  },
  main: { flex: 1 },
  doneText: { color: theme.color.muted, textDecorationLine: 'line-through' },
  due: { color: theme.color.muted },
  urgent: { color: theme.color.now, fontFamily: theme.font.appBold },
});
