import type { ClassType } from '../domain/types';

export const theme = {
  color: {
    paper: '#F4F6F8',
    ink: '#17213A',
    muted: '#48536B',
    rule: '#C9CFD8',
    course: '#C3CBF2',
    seminar: '#F6D9B0',
    lab: '#BFE3DA',
    now: '#C8302A',
  },
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
