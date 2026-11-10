import { router, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, View } from 'react-native';
import { tabBarBottomPad } from '../../src/ui/tabBar';
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
  const insets = useSafeAreaInsets();
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
        style={wide ? styles.sideItem : [styles.tabItem, active && styles.tabItemActive]}
      >
        {wide ? <View style={[styles.marker, active && styles.markerActive]} /> : null}
        <Text
          numberOfLines={1}
          style={
            wide
              ? [styles.label, active && styles.labelActive]
              : [styles.tabLabel, active && styles.tabLabelActive]
          }
        >
          {label}
        </Text>
      </Pressable>
    );
  });

  if (!wide) {
    return (
      <View style={[styles.tabBar, { paddingBottom: tabBarBottomPad(insets.bottom) }]}>
        <View accessibilityRole="tablist" style={styles.tabRow}>
          {items}
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Sidebar" style={styles.sidebar}>
      <View accessibilityRole="tablist">{items}</View>
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
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} layout={layout} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: layout === 'wide' ? 'left' : 'bottom',
        // Keep content below the status bar, so it never scrolls under it (where iOS blurs it).
        sceneStyle: { paddingTop: insets.top, backgroundColor: theme.color.paper },
      }}
    >
      {TABS.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ title: label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.color.paper,
    paddingHorizontal: theme.space(3),
    paddingTop: theme.space(2),
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.color.ink,
    borderRadius: 30,
    padding: theme.space(1.5),
    gap: theme.space(1),
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: theme.space(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: { backgroundColor: theme.color.paper },
  tabLabel: { fontFamily: theme.font.app, fontSize: 13, color: theme.color.rule },
  tabLabelActive: { fontFamily: theme.font.appBold, color: theme.color.ink },
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
