import { isSafeLinkUrl } from '../../src/domain/links';

describe('isSafeLinkUrl', () => {
  it('allows http, https and mailto, ignoring case and outer spaces', () => {
    for (const u of ['http://a.b', 'https://a.b/x', 'HTTPS://A.B', ' mailto:a@b.c']) {
      expect(isSafeLinkUrl(u)).toBe(true);
    }
  });
  it('rejects other schemes', () => {
    for (const u of [
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,x',
      'file:///x',
      'a.b',
      '',
    ]) {
      expect(isSafeLinkUrl(u)).toBe(false);
    }
  });
});
