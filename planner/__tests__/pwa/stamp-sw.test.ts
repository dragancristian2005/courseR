import fs from 'fs';
import os from 'os';
import path from 'path';

const { cacheNameFor, stampSource, main } = require('../../scripts/stamp-sw.js');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

describe('stamp-sw', () => {
  it('names the cache from the file list, keeping the planner- prefix', () => {
    const a = cacheNameFor(['js/web/entry-aaa.js']);
    expect(a).toMatch(/^planner-[0-9a-f]{10}$/);
    expect(cacheNameFor(['js/web/entry-aaa.js'])).toBe(a);
    expect(cacheNameFor(['js/web/entry-bbb.js'])).not.toBe(a);
  });

  it('replaces the placeholder in the real sw.js source', () => {
    const out = stampSource(source, ['x.js']);
    expect(out).toContain(`var CACHE_NAME = '${cacheNameFor(['x.js'])}';`);
    expect(out).not.toContain('planner-dev');
  });

  it('refuses a source without the placeholder', () => {
    expect(() => stampSource('var x;', [])).toThrow(/planner-dev/);
  });

  it('stamps dist/sw.js and fails clearly when it is missing', () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
    expect(() => main(dist)).toThrow(/sw\.js not found/);
    fs.mkdirSync(path.join(dist, '_expo', 'static', 'js'), { recursive: true });
    fs.writeFileSync(path.join(dist, '_expo', 'static', 'js', 'entry-1.js'), '');
    fs.writeFileSync(path.join(dist, 'sw.js'), source);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    main(dist);
    expect(fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')).toMatch(
      /var CACHE_NAME = 'planner-[0-9a-f]{10}';/,
    );
  });
});
