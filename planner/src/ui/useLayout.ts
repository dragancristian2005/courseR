import { useWindowDimensions } from 'react-native';

export type Layout = 'phone' | 'wide';

export const WIDE_BREAKPOINT = 900;

export function useLayout(): Layout {
  return useWindowDimensions().width >= WIDE_BREAKPOINT ? 'wide' : 'phone';
}
