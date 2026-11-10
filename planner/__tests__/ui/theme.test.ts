import * as Schibsted from '@expo-google-fonts/schibsted-grotesk';
import * as Newsreader from '@expo-google-fonts/newsreader';
import { theme, typeFill } from '../../src/ui/theme';

describe('theme', () => {
  it('has the colour tokens', () => {
    expect(theme.color).toEqual({
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
    });
  });

  it('typeFill maps class types to fills', () => {
    expect(typeFill('course')).toBe('#C3CBF2');
    expect(typeFill('seminar')).toBe('#F6D9B0');
    expect(typeFill('lab')).toBe('#BFE3DA');
  });

  it('font names match the real font package exports', () => {
    expect(theme.font.app in Schibsted).toBe(true);
    expect(theme.font.appBold in Schibsted).toBe(true);
    expect(theme.font.note in Newsreader).toBe(true);
    expect(theme.font.appBold).toBe('SchibstedGrotesk_800ExtraBold');
    expect(theme.font.note).toBe('Newsreader_400Regular_Italic');
  });

  it('space scales by 4', () => {
    expect(theme.space(2)).toBe(8);
  });
});
