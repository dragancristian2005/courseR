const mockApp = {
  getApps: jest.fn(),
  initializeApp: jest.fn(),
  getApp: jest.fn(),
};
const mockAuth = { initializeAuth: jest.fn(), getAuth: jest.fn() };
jest.mock('firebase/app', () => ({
  getApps: (...a: unknown[]) => mockApp.getApps(...a),
  initializeApp: (...a: unknown[]) => mockApp.initializeApp(...a),
  getApp: (...a: unknown[]) => mockApp.getApp(...a),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: (...a: unknown[]) => mockAuth.initializeAuth(...a),
  getAuth: (...a: unknown[]) => mockAuth.getAuth(...a),
  browserSessionPersistence: 'session',
  browserPopupRedirectResolver: 'resolver',
}));
jest.mock('firebase/firestore', () => ({}));

const ENV = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
];

describe('initClassroomAuth', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ENV.forEach((k) => (process.env['EXPO_PUBLIC_FIREBASE_' + k] = 'x-' + k));
    mockApp.getApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    mockApp.initializeApp.mockReturnValue({ name: 'classroom' });
    mockAuth.initializeAuth.mockReturnValue({ id: 'auth' });
  });

  it('creates a named secondary app with session persistence, once', () => {
    const { initClassroomAuth } = require('../../src/data/firebase');
    const a = initClassroomAuth();
    expect(mockApp.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'x-API_KEY', projectId: 'x-PROJECT_ID' }),
      'classroom',
    );
    expect(mockAuth.initializeAuth).toHaveBeenCalledWith(
      { name: 'classroom' },
      { persistence: 'session', popupRedirectResolver: 'resolver' },
    );
    expect(initClassroomAuth()).toBe(a);
    expect(mockAuth.initializeAuth).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing classroom app', () => {
    const existing = { name: 'classroom' };
    mockApp.getApps.mockReturnValue([{ name: '[DEFAULT]' }, existing]);
    const { initClassroomAuth } = require('../../src/data/firebase');
    initClassroomAuth();
    expect(mockApp.initializeApp).not.toHaveBeenCalled();
    expect(mockAuth.initializeAuth).toHaveBeenCalledWith(existing, expect.anything());
  });

  it('throws when Firebase is not configured', () => {
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const { initClassroomAuth } = require('../../src/data/firebase');
    expect(() => initClassroomAuth()).toThrow('Firebase is not configured');
  });
});
