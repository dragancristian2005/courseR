import { Platform } from 'react-native';
import type { ClassType } from '../domain/types';

/** Colours for the light and dark appearance. Keep public/index.html in step (a test checks). */
export const palette = {
  light: {
    paper: '#F4F6F8',
    ink: '#17213A',
    muted: '#48536B',
    rule: '#C9CFD8',
    course: '#C3CBF2',
    seminar: '#F6D9B0',
    lab: '#BFE3DA',
    now: '#C8302A',
    bar: '#17213A',
    barPill: '#F4F6F8',
    barActive: '#17213A',
    barIdle: '#C9CFD8',
  },
  dark: {
    paper: '#0F141D',
    ink: '#E6EAF0',
    muted: '#A3ACBD',
    rule: '#343D4E',
    course: '#2C3766',
    seminar: '#533F22',
    lab: '#1C443D',
    now: '#FF7466',
    bar: '#1F2737',
    barPill: '#E6EAF0',
    barActive: '#0F141D',
    barIdle: '#9AA4B6',
  },
} as const;

export type ColorToken = keyof typeof palette.light;

/** The CSS variable holding a colour on the web (defined in public/index.html). */
export const cssVar = (t: ColorToken): string => `var(--c-${t})`;

const tokens = Object.keys(palette.light) as ColorToken[];

/**
 * On the web each colour is a CSS variable, so the app follows the phone's light/dark setting
 * instantly. Elsewhere (and in tests) it is the light colour.
 */
const color = Object.fromEntries(
  tokens.map((t) => [t, Platform.OS === 'web' ? cssVar(t) : palette.light[t]]),
) as Record<ColorToken, string>;

export const theme = {
  color,
  font: {
    app: 'SchibstedGrotesk_400Regular',
    appBold: 'SchibstedGrotesk_800ExtraBold',
    note: 'Newsreader_400Regular_Italic',
  },
  space: (n: number): number => n * 4,
} as const;

export function typeFill(type: ClassType): string {
  return theme.color[type];
}
