import { Platform } from 'react-native';
import { saveCalendarFile } from '../../src/data/calendarFile';

const g = globalThis as unknown as { navigator: Record<string, unknown> };
const original = Platform.OS;
const originalNav = g.navigator;

const g2 = globalThis as unknown as { document?: unknown };
const anchor = { click: jest.fn(), href: '', download: '' };
function stubDocument() {
  g2.document = {
    createElement: jest.fn(() => anchor),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
  };
}

afterEach(() => {
  delete g2.document;
  Platform.OS = original;
  g.navigator = originalNav;
  jest.restoreAllMocks();
});

function web(nav: Record<string, unknown>) {
  Platform.OS = 'web';
  g.navigator = nav;
}

describe('saveCalendarFile', () => {
  it('is unsupported on native', async () => {
    Platform.OS = 'ios';
    expect(await saveCalendarFile('x', 'a.ics')).toBe('unsupported');
  });

  it('shares a file when the browser can', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    web({ canShare: () => true, share });
    expect(await saveCalendarFile('BEGIN', 'a.ics')).toBe('shared');
    const arg = share.mock.calls[0][0];
    expect(arg.title).toBe('Study Planner');
    expect(arg.files[0].name).toBe('a.ics');
    expect(arg.files[0].type).toBe('text/calendar');
  });

  it('reports a cancelled share without downloading', async () => {
    const share = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    web({ canShare: () => true, share });
    const create = jest.spyOn(URL, 'createObjectURL');
    expect(await saveCalendarFile('x', 'a.ics')).toBe('cancelled');
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails otherwise', async () => {
    const share = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    web({ canShare: () => true, share });
    stubDocument();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    expect(await saveCalendarFile('x', 'a.ics')).toBe('downloaded');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe('a.ics');
  });

  it('downloads when the browser cannot share files', async () => {
    web({});
    stubDocument();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    expect(await saveCalendarFile('x', 'a.ics')).toBe('downloaded');
  });
});
