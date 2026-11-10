import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { springTo, useReducedMotion } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that dips slightly while pressed, so a tap feels answered. */
export function PressScale({
  style,
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.96,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!rest.disabled) springTo(scale, scaleTo, reduced);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        springTo(scale, 1, reduced);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
