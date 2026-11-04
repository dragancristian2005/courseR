import { router, Tabs, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';
import { useLayout, type Layout } from '../../src/ui/useLayout';

const TABS = [
  { name: 'index', label: 'Today', href: '/' },
  { name: 'week', label: 'Week', href: '/week' },
  { name: 'homework', label: 'Homework', href: '/homework' },
  { name: 'notes', label: 'Notes', href: '/notes' },
  { name: 'links', label: 'Links', href: '/links' },
] as const satisfies readonly { name: string; label: string; href: Href }[];

interface BarProps {
  state: { index: number; routes: { name: string }[] };
}

function NavBar({ state, layout }: BarProps & { layout: Layout }) {
  const wide = layout === 'wide';
  const activeName = state.routes[state.index]?.name;

  const items = TABS.map(({ name, label, href }) => {
    const active = activeName === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => router.navigate(href)}
        style={wide ? styles.sideItem : styles.tabItem}
      >
        {wide ? <View style={[styles.marker, active && styles.markerActive]} /> : null}
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Pressable>
    );
  });

  if (!wide) {
    return (
      <View style={styles.tabBar}>
        <Rule weight="heavy" />
        <View style={styles.tabRow}>{items}</View>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Sidebar" style={styles.sidebar}>
      <View>{items}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push('/settings')}
        style={styles.sideItem}
      >
        <View style={styles.marker} />
        <Text style={styles.label}>Settings</Text>
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const layout = useLayout();
  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} layout={layout} />}
      screenOptions={{ headerShown: false, tabBarPosition: layout === 'wide' ? 'left' : 'bottom' }}
    >
      {TABS.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: theme.color.paper },
  tabRow: { flexDirection: 'row' },
  tabItem: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  sidebar: {
    width: 180,
    justifyContent: 'space-between',
    backgroundColor: theme.color.paper,
    borderRightWidth: 2,
    borderRightColor: theme.color.ink,
    paddingVertical: theme.space(4),
  },
  sideItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  marker: { width: 4, alignSelf: 'stretch', marginRight: theme.space(3) },
  markerActive: { backgroundColor: theme.color.ink },
  label: { fontFamily: theme.font.app, fontSize: 15, color: theme.color.muted },
  labelActive: { fontFamily: theme.font.appBold, color: theme.color.ink },
});
