import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { chooseSignInMethod, useAuth } from '../../src/data/auth';

const mockFb = {
  getRedirectResult: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithRedirect: jest.fn(),
};
jest.mock('firebase/auth', () => ({
  getRedirectResult: (...a: unknown[]) => mockFb.getRedirectResult(...a),
  GoogleAuthProvider: jest.fn(),
  onAuthStateChanged: jest.fn(() => () => {}),
  signInWithPopup: (...a: unknown[]) => mockFb.signInWithPopup(...a),
  signInWithRedirect: (...a: unknown[]) => mockFb.signInWithRedirect(...a),
  signOut: jest.fn(),
}));
jest.mock('../../src/data/firebase', () => ({
  initFirebase: () => ({ auth: { a: 1 } }),
}));

describe('chooseSignInMethod', () => {
  it('uses a popup in a normal browser tab', () => {
    expect(
      chooseSignInMethod({
        matchMedia: () => ({ matches: false }),
        navigator: {},
      }),
    ).toBe('popup');
  });
  it('uses redirect in display-mode standalone', () => {
    expect(
      chooseSignInMethod({
        matchMedia: () => ({ matches: true }),
        navigator: {},
      }),
    ).toBe('redirect');
  });
  it('uses redirect for iOS navigator.standalone', () => {
    expect(
      chooseSignInMethod({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      }),
    ).toBe('redirect');
  });
  it('falls back to popup without matchMedia', () => {
    expect(chooseSignInMethod({ navigator: {} })).toBe('popup');
  });
});

describe('useAuth sign-in branch on web', () => {
  const original = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    mockFb.getRedirectResult.mockResolvedValue(null);
    mockFb.signInWithPopup.mockResolvedValue(undefined);
    mockFb.signInWithRedirect.mockResolvedValue(undefined);
  });
  afterAll(() => {
    Platform.OS = original;
    delete (globalThis as any).matchMedia;
  });

  it('signs in with a popup in a browser tab', async () => {
    (globalThis as any).matchMedia = () => ({ matches: false });
    const { result } = await renderHook(() => useAuth());
    await act(async () => result.current.signIn());
    expect(mockFb.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(mockFb.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('signs in with a redirect when installed, and reads the result once', async () => {
    (globalThis as any).matchMedia = () => ({ matches: true });
    const { result } = await renderHook(() => useAuth());
    await act(async () => result.current.signIn());
    expect(mockFb.signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(mockFb.signInWithPopup).not.toHaveBeenCalled();
    expect(mockFb.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  it('surfaces a redirect error', async () => {
    mockFb.getRedirectResult.mockRejectedValue(new Error('nope'));
    const { result } = await renderHook(() => useAuth());
    await act(async () => {});
    expect(result.current.redirectFailed).toBe(true);
  });
});
