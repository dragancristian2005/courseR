import { Platform } from 'react-native';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  takeClassroomToken,
} from '../../src/data/classroom';

const mockFb = {
  signInWithPopup: jest.fn(),
  signInWithRedirect: jest.fn(),
  getRedirectResult: jest.fn(),
  signOut: jest.fn(),
  credentialFromResult: jest.fn(),
  addScope: jest.fn(),
  setCustomParameters: jest.fn(),
};
const classroomAuth = { name: 'classroom-auth' };
const mainAuth = { name: 'main-auth' };

jest.mock('firebase/auth', () => ({
  signInWithPopup: (...a: unknown[]) => mockFb.signInWithPopup(...a),
  signInWithRedirect: (...a: unknown[]) => mockFb.signInWithRedirect(...a),
  getRedirectResult: (...a: unknown[]) => mockFb.getRedirectResult(...a),
  signOut: (...a: unknown[]) => mockFb.signOut(...a),
  GoogleAuthProvider: Object.assign(
    jest.fn().mockImplementation(() => ({
      addScope: mockFb.addScope,
      setCustomParameters: mockFb.setCustomParameters,
    })),
    { credentialFromResult: (...a: unknown[]) => mockFb.credentialFromResult(...a) },
  ),
}));
jest.mock('../../src/data/firebase', () => ({
  initClassroomAuth: () => classroomAuth,
  initFirebase: () => ({ auth: mainAuth }),
}));

const FLAG = 'planner.classroomRedirect';
const store: Record<string, string> = {};
const g = globalThis as any;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(store).forEach((k) => delete store[k]);
  g.sessionStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  g.matchMedia = () => ({ matches: false });
  Platform.OS = 'web';
  mockFb.signOut.mockResolvedValue(undefined);
  mockFb.credentialFromResult.mockReturnValue({ accessToken: 'tok' });
});

const authError = (code: string) => Object.assign(new Error(code), { code });

describe('getClassroomToken', () => {
  it('popup: signs in on the secondary auth, returns the token and signs out', async () => {
    mockFb.signInWithPopup.mockResolvedValue({ user: {} });
    await expect(getClassroomToken()).resolves.toBe('tok');
    expect(mockFb.signInWithPopup).toHaveBeenCalledWith(classroomAuth, expect.anything());
    expect(mockFb.addScope).toHaveBeenCalledWith(
      'https://www.googleapis.com/auth/classroom.courses.readonly',
    );
    expect(mockFb.addScope).toHaveBeenCalledWith(
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    );
    expect(mockFb.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    expect(mockFb.signOut).toHaveBeenCalledWith(classroomAuth);
    for (const call of [...mockFb.signInWithPopup.mock.calls, ...mockFb.signOut.mock.calls]) {
      expect(call[0]).not.toBe(mainAuth);
    }
    expect(store[FLAG]).toBeUndefined();
  });

  it('popup: a failing sign-out does not lose the token', async () => {
    mockFb.signInWithPopup.mockResolvedValue({});
    mockFb.signOut.mockRejectedValue(new Error('boom'));
    await expect(getClassroomToken()).resolves.toBe('tok');
  });

  it('popup: no token is an other error', async () => {
    mockFb.signInWithPopup.mockResolvedValue({});
    mockFb.credentialFromResult.mockReturnValue(null);
    await expect(getClassroomToken()).rejects.toMatchObject({ kind: 'other' });
  });

  it('standalone: sets the flag, redirects and returns "redirecting"', async () => {
    g.matchMedia = () => ({ matches: true });
    mockFb.signInWithRedirect.mockResolvedValue(undefined);
    await expect(getClassroomToken()).resolves.toBe('redirecting');
    expect(store[FLAG]).toBe('1');
    expect(mockFb.signInWithRedirect).toHaveBeenCalledWith(classroomAuth, expect.anything());
    expect(mockFb.signInWithPopup).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/popup-closed-by-user', 'denied'],
    ['auth/cancelled-popup-request', 'denied'],
    ['auth/user-cancelled', 'denied'],
    ['auth/access-denied', 'denied'],
    ['auth/network-request-failed', 'network'],
    ['auth/internal-error', 'other'],
  ])('maps %s to %s', async (code, kind) => {
    mockFb.signInWithPopup.mockRejectedValue(authError(code));
    await expect(getClassroomToken()).rejects.toMatchObject({ kind });
  });

  it('maps an OAuth access_denied message to denied', async () => {
    mockFb.signInWithPopup.mockRejectedValue(new Error('access_denied'));
    await expect(getClassroomToken()).rejects.toMatchObject({ kind: 'denied' });
  });
});

describe('takeClassroomToken', () => {
  it('returns null without touching Firebase when the flag is absent', async () => {
    await expect(takeClassroomToken()).resolves.toBeNull();
    expect(mockFb.getRedirectResult).not.toHaveBeenCalled();
  });

  it('returns the token once when the flag is set, and signs out', async () => {
    store[FLAG] = '1';
    mockFb.getRedirectResult.mockResolvedValue({ user: {} });
    await expect(takeClassroomToken()).resolves.toBe('tok');
    expect(mockFb.getRedirectResult).toHaveBeenCalledWith(classroomAuth);
    expect(mockFb.signOut).toHaveBeenCalledWith(classroomAuth);
    expect(store[FLAG]).toBeUndefined();
    await expect(takeClassroomToken()).resolves.toBeNull();
    expect(mockFb.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  it('returns null when the redirect result has no token', async () => {
    store[FLAG] = '1';
    mockFb.getRedirectResult.mockResolvedValue(null);
    mockFb.credentialFromResult.mockReturnValue(null);
    await expect(takeClassroomToken()).resolves.toBeNull();
    expect(store[FLAG]).toBeUndefined();
  });

  it('clears the flag and maps errors', async () => {
    store[FLAG] = '1';
    mockFb.getRedirectResult.mockRejectedValue(authError('auth/access-denied'));
    await expect(takeClassroomToken()).rejects.toMatchObject({ kind: 'denied' });
    expect(store[FLAG]).toBeUndefined();
  });

  it('survives sessionStorage throwing', async () => {
    g.sessionStorage = {
      getItem: () => {
        throw new Error('no storage');
      },
    };
    await expect(takeClassroomToken()).resolves.toBeNull();
  });
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, error: object) => ({
  ok: false,
  status,
  json: async () => ({ error }),
});
const BASE = 'https://classroom.googleapis.com/v1';

function route(map: Record<string, unknown[]>) {
  const fetchMock = jest.fn(async (url: string) => {
    const q = Object.keys(map).find((k) => url.startsWith(k + '?') || url === k);
    if (!q) throw new Error('unexpected ' + url);
    const pages = map[q];
    const token = new URL(url).searchParams.get('pageToken');
    return ok(pages[token ? Number(token.replace('p', '')) : 0]);
  });
  g.fetch = fetchMock;
  return fetchMock;
}

describe('fetchClassroom', () => {
  it('paginates courses, work and submissions and builds turnedIn', async () => {
    const fetchMock = route({
      [`${BASE}/courses`]: [
        { courses: [{ id: 'c1', name: 'Math', section: 'A' }], nextPageToken: 'p1' },
        { courses: [{ id: 'c 2', name: 'Bio' }] },
      ],
      [`${BASE}/courses/c1/courseWork`]: [
        {
          courseWork: [
            {
              id: 'w1',
              title: 'HW1',
              dueDate: { year: 2026, month: 11, day: 9 },
              dueTime: { hours: 21 },
            },
          ],
          nextPageToken: 'p1',
        },
        { courseWork: [{ id: 'w2', title: 'HW2' }] },
      ],
      [`${BASE}/courses/c1/courseWork/-/studentSubmissions`]: [
        {
          studentSubmissions: [
            { courseWorkId: 'w1', state: 'TURNED_IN' },
            { courseWorkId: 'w2', state: 'CREATED' },
          ],
          nextPageToken: 'p1',
        },
        {
          studentSubmissions: [
            { courseWorkId: 'w3', state: 'RETURNED' },
            { courseWorkId: 'w4', state: 'NEW' },
          ],
        },
      ],
      [`${BASE}/courses/c%202/courseWork`]: [{}],
      [`${BASE}/courses/c%202/courseWork/-/studentSubmissions`]: [{}],
    });

    const r = await fetchClassroom('abc');
    expect(r.courses).toEqual([
      { id: 'c1', name: 'Math', section: 'A' },
      { id: 'c 2', name: 'Bio', section: null },
    ]);
    expect(r.work).toEqual([
      {
        id: 'w1',
        courseId: 'c1',
        title: 'HW1',
        dueDate: { year: 2026, month: 11, day: 9 },
        dueTime: { hours: 21 },
      },
      { id: 'w2', courseId: 'c1', title: 'HW2', dueDate: null, dueTime: null },
    ]);
    expect([...r.turnedIn].sort()).toEqual(['w1', 'w3']);

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls[0]).toBe(`${BASE}/courses?studentId=me&courseStates=ACTIVE&pageSize=100`);
    expect(urls[1]).toBe(
      `${BASE}/courses?studentId=me&courseStates=ACTIVE&pageSize=100&pageToken=p1`,
    );
    expect(urls).toContain(
      `${BASE}/courses/c1/courseWork?courseWorkStates=PUBLISHED&pageSize=100&pageToken=p1`,
    );
    expect(urls).toContain(
      `${BASE}/courses/c1/courseWork/-/studentSubmissions?userId=me&pageSize=100&pageToken=p1`,
    );
    expect(urls).toContain(
      `${BASE}/courses/c%202/courseWork?courseWorkStates=PUBLISHED&pageSize=100`,
    );
    expect((fetchMock.mock.calls[0] as any)[1]).toEqual({
      headers: { Authorization: 'Bearer abc' },
    });
  });

  it('returns empty results when there are no courses', async () => {
    route({ [`${BASE}/courses`]: [{}] });
    const r = await fetchClassroom('t');
    expect(r).toEqual({ courses: [], work: [], turnedIn: new Set() });
  });

  it('maps a fetch TypeError to network', async () => {
    g.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await fetchClassroom('t').catch((x) => x);
    expect(e).toBeInstanceOf(ClassroomError);
    expect(e.kind).toBe('network');
    expect(e.message).toBe('Couldn’t reach Google Classroom. Check your connection and try again.');
  });

  it('maps 403 PERMISSION_DENIED to blocked', async () => {
    g.fetch = jest
      .fn()
      .mockResolvedValue(fail(403, { code: 403, status: 'PERMISSION_DENIED', message: 'no' }));
    const e = await fetchClassroom('t').catch((x) => x);
    expect(e.kind).toBe('blocked');
    expect(e.message).toBe(
      'Your school’s Google account doesn’t allow this app to read Classroom.',
    );
  });

  it('maps other failures to other', async () => {
    g.fetch = jest
      .fn()
      .mockResolvedValue(fail(500, { code: 500, status: 'INTERNAL', message: 'x' }));
    const e = await fetchClassroom('t').catch((x) => x);
    expect(e.kind).toBe('other');
    expect(e.message).toBe('Something went wrong reading Classroom. Try again.');
  });

  it('maps an unparseable error body to other', async () => {
    g.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('bad json');
      },
    });
    await expect(fetchClassroom('t')).rejects.toMatchObject({ kind: 'other' });
  });

  it('exposes the denied message', () => {
    expect(new ClassroomError('denied').message).toBe('Classroom access wasn’t allowed.');
  });
});
