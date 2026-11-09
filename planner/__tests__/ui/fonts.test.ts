import { fontsSettled } from '../../src/ui/fonts';

describe('fontsSettled', () => {
  it('waits while fonts are loading', () => {
    expect(fontsSettled(false, null)).toBe(false);
  });
  it('continues once fonts are loaded', () => {
    expect(fontsSettled(true, null)).toBe(true);
  });
  it('continues with the system font when a font fails to load', () => {
    expect(fontsSettled(false, new Error('timed out after 12000ms'))).toBe(true);
  });
});
