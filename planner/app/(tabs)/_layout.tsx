import { router, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { springTo, useReducedMotion } from '../../src/ui/motion';
import { PressScale } from '../../src/ui/PressScale';
import { tabBarBottomPad } from '../../src/ui/tabBar';
import { TabIcon } from '../../src/ui/TabIcon';
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

const ROW_PAD = theme.space(1.5);
const ROW_GAP = theme.space(1);

function NavBar({ state, layout }: BarProps & { layout: Layout }) {
  const wide = layout === 'wide';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.name === activeName),
  );

  // The highlight is one pill that slides between tabs. Until the bar has been measured, the
  // active tab draws its own background instead.
  const [rowWidth, setRowWidth] = useState(0);
  const itemWidth =
    rowWidth > 0 ? (rowWidth - 2 * ROW_PAD - (TABS.length - 1) * ROW_GAP) / TABS.length : 0;
  const pillX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (itemWidth <= 0) return;
    const x = ROW_PAD + activeIndex * (itemWidth + ROW_GAP);
    // The first placement jumps; later ones slide.
    springTo(pillX, x, reduced || !placed.current);
    placed.current = true;
  }, [activeIndex, itemWidth, reduced, pillX]);

  const items = TABS.map(({ name, label, href }) => {
    const active = activeName === name;
    if (wide) {
      return (
        <Pressable
          key={name}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: active }}
          onPress={() => router.navigate(href)}
          style={styles.sideItem}
        >
          <View style={[styles.marker, active && styles.markerActive]} />
          <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
            {label}
          </Text>
        </Pressable>
      );
    }
    const color = active ? theme.color.ink : theme.color.rule;
    return (
      <PressScale
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => router.navigate(href)}
        style={[styles.tabItem, active && itemWidth <= 0 && styles.tabItemActive]}
      >
        <TabIcon name={label} color={color} />
        <Text
          numberOfLines={1}
          style={[styles.tabLabel, { color }, active && styles.tabLabelActive]}
        >
          {label}
        </Text>
      </PressScale>
    );
  });

  if (!wide) {
    return (
      <View style={[styles.tabBar, { paddingBottom: tabBarBottomPad(insets.bottom) }]}>
        <View
          accessibilityRole="tablist"
          style={styles.tabRow}
          onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        >
          {itemWidth > 0 ? (
            <Animated.View
              testID="tab-indicator"
              pointerEvents="none"
              style={[styles.pill, { width: itemWidth, transform: [{ translateX: pillX }] }]}
            />
          ) : null}
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
  const reduced = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} layout={layout} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: layout === 'wide' ? 'left' : 'bottom',
        animation: reduced ? 'none' : 'fade',
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
    padding: ROW_PAD,
    gap: ROW_GAP,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: ROW_PAD,
    bottom: ROW_PAD,
    borderRadius: 24,
    backgroundColor: theme.color.paper,
  },
  tabItem: {
    flex: 1,
    minHeight: 52,
    borderRadius: 24,
    paddingHorizontal: theme.space(1),
    paddingVertical: theme.space(1.5),
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: { backgroundColor: theme.color.paper },
  tabLabel: { fontFamily: theme.font.app, fontSize: 11 },
  tabLabelActive: { fontFamily: theme.font.appBold },
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
