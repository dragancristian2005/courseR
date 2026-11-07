import { Platform } from 'react-native';
import { openCalendarFile, shareCalendarFile } from '../../src/data/calendarFile';

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

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' };
const DESKTOP = { userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32' };

describe('openCalendarFile', () => {
  const win = globalThis as unknown as { window?: unknown };
  afterEach(() => delete win.window);

  it('is unsupported on native', () => {
    Platform.OS = 'ios';
    expect(openCalendarFile('x', 'a.ics')).toBe('unsupported');
  });

  it('navigates to a calendar blob URL on iOS', () => {
    web(IPHONE);
    const location = { href: '' };
    win.window = { location };
    URL.createObjectURL = jest.fn(() => 'blob:cal');
    expect(openCalendarFile('x', 'a.ics')).toBe('opened');
    expect(location.href).toBe('blob:cal');
    const blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/calendar;charset=utf-8');
  });

  it('treats iPadOS desktop-mode Safari as iOS', () => {
    web({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 });
    const location = { href: '' };
    win.window = { location };
    URL.createObjectURL = jest.fn(() => 'blob:cal');
    expect(openCalendarFile('x', 'a.ics')).toBe('opened');
    expect(location.href).toBe('blob:cal');
  });

  it('downloads on desktop even when the browser can share', () => {
    const share = jest.fn();
    web({ ...DESKTOP, canShare: () => true, share });
    stubDocument();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    expect(openCalendarFile('x', 'a.ics')).toBe('downloaded');
    expect(anchor.download).toBe('a.ics');
    expect(share).not.toHaveBeenCalled();
  });
});

describe('shareCalendarFile', () => {
  it('is unsupported on native', async () => {
    Platform.OS = 'ios';
    expect(await shareCalendarFile('x', 'a.ics')).toBe('unsupported');
  });

  it('shares only the file when the browser can', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    web({ canShare: () => true, share });
    expect(await shareCalendarFile('BEGIN', 'a.ics')).toBe('shared');
    const arg = share.mock.calls[0][0];
    expect(Object.keys(arg)).toEqual(['files']);
    expect(arg.files[0].name).toBe('a.ics');
    expect(arg.files[0].type).toBe('text/calendar;charset=utf-8');
  });

  it('reports a cancelled share without downloading', async () => {
    const share = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    web({ canShare: () => true, share });
    const create = jest.fn(() => 'blob:x');
    URL.createObjectURL = create;
    expect(await shareCalendarFile('x', 'a.ics')).toBe('cancelled');
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails otherwise', async () => {
    const share = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    web({ canShare: () => true, share });
    stubDocument();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    expect(await shareCalendarFile('x', 'a.ics')).toBe('downloaded');
    expect(anchor.download).toBe('a.ics');
  });

  it('downloads when the browser cannot share files', async () => {
    web({});
    stubDocument();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    expect(await shareCalendarFile('x', 'a.ics')).toBe('downloaded');
  });
});
