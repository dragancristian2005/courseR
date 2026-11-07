import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme } from './theme';

/** A subject of the import with its attending switch, as in Settings → Subjects. */
export function ImportSubjectRow({
  name,
  abbreviation,
  existing,
  on,
  onToggle,
}: {
  name: string;
  abbreviation: string;
  existing: boolean;
  on: boolean;
  onToggle: (attending: boolean) => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.name}>{name}</Text>
          <Text variant="meta">{abbreviation}</Text>
          {existing ? <Text variant="meta">Already in your planner</Text> : null}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={name}
          accessibilityState={{ checked: on }}
          onPress={() => onToggle(!on)}
          style={styles.switchHit}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Switch value={on} trackColor={{ true: theme.color.ink, false: theme.color.rule }} />
          </View>
        </Pressable>
      </View>
      <Rule weight="hair" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(1),
  },
  text: { flex: 1 },
  switchHit: { minHeight: 56, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: theme.font.appBold },
});
