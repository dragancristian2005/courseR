import { newId } from '../../src/data/ids';

describe('newId', () => {
  it('is lowercase base36, never contains a colon, and is unique', () => {
    const ids = Array.from({ length: 200 }, () => newId());
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/);
    expect(new Set(ids).size).toBe(200);
  });
});
