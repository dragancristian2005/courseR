declare module 'react-native-web' {
  import type { ReactElement } from 'react';
  /** Renders a real DOM element (e.g. an <input>) inside react-native-web. */
  export function unstable_createElement(
    component: string,
    props?: Record<string, unknown>,
  ): ReactElement;
}
