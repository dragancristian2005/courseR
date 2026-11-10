import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BackLink } from './BackLink';
import { TOP_CLEARANCE } from './tabBar';
import { theme } from './theme';

const ROW = 44;
// The Back label sits ~12px down its 44px row, so this keeps its top TOP_CLEARANCE clear.
const LIFT = TOP_CLEARANCE - 12;

/** A slim header for pushed screens: just Back, right under the status bar. */
export function CompactHeader() {
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;
  return (
    <View
      testID="compact-header"
      style={[styles.bar, { paddingTop: top + LIFT, height: top + LIFT + ROW }]}
    >
      <BackLink />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.color.paper,
    paddingHorizontal: theme.space(2),
    justifyContent: 'center',
  },
});
