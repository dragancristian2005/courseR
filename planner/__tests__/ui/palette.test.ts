import { readFileSync } from 'fs';
import { join } from 'path';
import { palette, cssVar, type ColorToken } from '../../src/ui/theme';

/** WCAG relative luminance contrast ratio of two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const html = readFileSync(join(__dirname, '../../public/index.html'), 'utf8');

describe('palette', () => {
  const tokens = Object.keys(palette.light) as ColorToken[];

  it('light and dark have the same tokens', () => {
    expect(Object.keys(palette.dark).sort()).toEqual([...tokens].sort());
  });

  it.each(['light', 'dark'] as const)('%s: text is readable (WCAG AA 4.5:1)', (mode) => {
    const p = palette[mode];
    expect(contrast(p.ink, p.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.now, p.paper)).toBeGreaterThanOrEqual(4.5);
    for (const fill of [p.course, p.seminar, p.lab]) {
      expect(contrast(p.ink, fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, fill)).toBeGreaterThanOrEqual(3);
    }
    // Primary buttons and selected chips: paper text on ink.
    expect(contrast(p.paper, p.ink)).toBeGreaterThanOrEqual(4.5);
    // Tab bar: active label on the pill, idle labels on the bar.
    expect(contrast(p.barActive, p.barPill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.barIdle, p.bar)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark mode has a dark page', () => {
    expect(contrast(palette.dark.paper, '#000000')).toBeLessThan(2);
  });

  it('index.html defines every colour variable for light and dark, so the page never flashes', () => {
    const dark = html.slice(html.indexOf('prefers-color-scheme: dark'));
    for (const t of tokens) {
      expect(html).toContain(`--c-${t}: ${palette.light[t]};`);
      expect(dark).toContain(`--c-${t}: ${palette.dark[t]};`);
    }
    expect(html).toContain(
      `<meta name="theme-color" content="${palette.dark.paper}" media="(prefers-color-scheme: dark)">`,
    );
    expect(html).toContain('color-scheme');
  });

  it('cssVar names the variable', () => {
    expect(cssVar('paper')).toBe('var(--c-paper)');
  });
});
