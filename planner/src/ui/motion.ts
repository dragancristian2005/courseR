import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';

/** The web has no native animation driver. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** True when the phone asks for less motion (iOS: Settings → Accessibility → Motion). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}

/** A soft spring to `toValue`, or an instant jump when motion is reduced. */
export function springTo(value: Animated.Value, toValue: number, reduced: boolean): void {
  if (reduced) {
    value.setValue(toValue);
    return;
  }
  Animated.spring(value, {
    toValue,
    useNativeDriver: NATIVE_DRIVER,
    speed: 20,
    bounciness: 6,
  }).start();
}
