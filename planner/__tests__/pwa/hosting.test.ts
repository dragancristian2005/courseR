import { readFileSync } from 'fs';
import { join } from 'path';

const config = JSON.parse(readFileSync(join(__dirname, '../../firebase.json'), 'utf8'));

describe('firebase.json hosting', () => {
  it('serves from dist', () => {
    expect(config.hosting.public).toBe('dist');
  });

  // Expo exports fonts and icons under dist/assets/node_modules/…; ignoring node_modules
  // leaves them out of the deploy and the ** rewrite answers with index.html instead.
  it('does not skip the assets Expo exports under node_modules', () => {
    for (const pattern of config.hosting.ignore ?? []) {
      expect(pattern).not.toContain('node_modules');
    }
  });
});
