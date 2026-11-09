import { Platform } from 'react-native';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  prepareClassroomSignIn,
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
const mockInit = jest.fn(() => classroomAuth);
jest.mock('../../src/data/firebase', () => ({
  initClassroomAuth: () => mockInit(),
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
  mockInit.mockImplementation(() => classroomAuth);
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

  it('popup: opens the Google window in the same tick as the tap', async () => {
    mockFb.signInWithPopup.mockResolvedValue({});
    const pending = getClassroomToken();
    // Safari only allows a popup opened before anything is awaited after the tap.
    expect(mockFb.signInWithPopup).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBe('tok');
  });

  it('popup: a blocked popup has its own message', async () => {
    mockFb.signInWithPopup.mockRejectedValue(authError('auth/popup-blocked'));
    const e = await getClassroomToken().catch((x) => x);
    expect(e).toMatchObject({ kind: 'popupBlocked' });
    expect(e.message).toBe(
      'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    );
  });

  it('standalone: clears the flag when the redirect cannot start', async () => {
    g.matchMedia = () => ({ matches: true });
    mockFb.signInWithRedirect.mockRejectedValue(authError('auth/network-request-failed'));
    await expect(getClassroomToken()).rejects.toMatchObject({ kind: 'network' });
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

describe('prepareClassroomSignIn', () => {
  it('sets up the Classroom auth ahead of the tap on the web', () => {
    prepareClassroomSignIn();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('does nothing off the web', () => {
    Platform.OS = 'ios';
    prepareClassroomSignIn();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('never throws, so a missing config only shows up on Connect', () => {
    mockInit.mockImplementation(() => {
      throw new Error('Firebase is not configured');
    });
    expect(() => prepareClassroomSignIn()).not.toThrow();
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
    expect(r).toEqual({ courses: [], work: [], turnedIn: new Set(), failedCourses: [] });
  });

  it('leaves out a course Google reports as archived (or in any non-active state)', async () => {
    route({
      [`${BASE}/courses`]: [
        {
          courses: [
            { id: 'c1', name: 'Math', courseState: 'ACTIVE' },
            { id: 'c2', name: 'Old', courseState: 'ARCHIVED' },
            { id: 'c3', name: 'Gone', courseState: 'DECLINED' },
          ],
        },
      ],
      [`${BASE}/courses/c1/courseWork`]: [{ courseWork: [{ id: 'w1', title: 'HW1' }] }],
      [`${BASE}/courses/c1/courseWork/-/studentSubmissions`]: [{}],
    });
    const r = await fetchClassroom('t');
    expect(r.courses.map((c) => c.id)).toEqual(['c1']);
    const urls = (g.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/courses/c2/'))).toBe(false);
  });

  it('skips a course that fails and names it, keeping the others', async () => {
    route({
      [`${BASE}/courses`]: [
        {
          courses: [
            { id: 'c1', name: 'Math' },
            { id: 'c2', name: 'Bio' },
          ],
        },
      ],
      [`${BASE}/courses/c1/courseWork`]: [{ courseWork: [{ id: 'w1', title: 'HW1' }] }],
      [`${BASE}/courses/c1/courseWork/-/studentSubmissions`]: [
        { studentSubmissions: [{ courseWorkId: 'w1', state: 'TURNED_IN' }] },
      ],
      [`${BASE}/courses/c2/courseWork`]: [{ courseWork: [{ id: 'w2', title: 'HW2' }] }],
    });
    const routed = g.fetch as jest.Mock;
    g.fetch = jest.fn(async (url: string) =>
      url.startsWith(`${BASE}/courses/c2/courseWork/-/studentSubmissions`)
        ? fail(404, { code: 404, status: 'NOT_FOUND', message: 'gone' })
        : routed(url),
    );
    const r = await fetchClassroom('t');
    expect(r.courses.map((c) => c.id)).toEqual(['c1']);
    expect(r.work.map((w) => w.id)).toEqual(['w1']);
    expect([...r.turnedIn]).toEqual(['w1']);
    expect(r.failedCourses).toEqual(['Bio']);
  });

  it('still fails when every course fails', async () => {
    route({
      [`${BASE}/courses`]: [{ courses: [{ id: 'c1', name: 'Math' }] }],
    });
    const routed = g.fetch as jest.Mock;
    g.fetch = jest.fn(async (url: string) =>
      url.startsWith(`${BASE}/courses/c1/`)
        ? fail(403, { code: 403, status: 'PERMISSION_DENIED', message: 'no' })
        : routed(url),
    );
    await expect(fetchClassroom('t')).rejects.toMatchObject({ kind: 'blocked' });
  });

  it('fails the whole import on a network error in one course', async () => {
    route({
      [`${BASE}/courses`]: [
        {
          courses: [
            { id: 'c1', name: 'Math' },
            { id: 'c2', name: 'Bio' },
          ],
        },
      ],
      [`${BASE}/courses/c1/courseWork`]: [{}],
      [`${BASE}/courses/c1/courseWork/-/studentSubmissions`]: [{}],
    });
    const routed = g.fetch as jest.Mock;
    g.fetch = jest.fn(async (url: string) => {
      if (url.startsWith(`${BASE}/courses/c2/`)) throw new TypeError('Failed to fetch');
      return routed(url);
    });
    await expect(fetchClassroom('t')).rejects.toMatchObject({ kind: 'network' });
  });

  it('reads up to four courses at once and keeps course order', async () => {
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const waiting: { url: string; resolve: (v: unknown) => void }[] = [];
    g.fetch = jest.fn((url: string) => {
      if (url.startsWith(`${BASE}/courses?`)) {
        return Promise.resolve(ok({ courses: ids.map((id) => ({ id, name: id })) }));
      }
      return new Promise((resolve) => waiting.push({ url, resolve }));
    });
    const result = fetchClassroom('t');
    await new Promise((r) => setTimeout(r, 0));
    const started = () => new Set(waiting.map((w) => w.url.split('/')[5]));
    expect([...started()].sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
    // Finish the courses in reverse order.
    for (const id of ['c4', 'c3', 'c2', 'c1']) {
      for (const w of waiting.filter((x) => x.url.split('/')[5] === id)) {
        w.resolve(
          ok(w.url.includes('studentSubmissions') ? {} : { courseWork: [{ id: `w-${id}` }] }),
        );
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(started().has('c5')).toBe(true);
    for (const w of waiting.filter((x) => x.url.split('/')[5] === 'c5')) {
      w.resolve(ok(w.url.includes('studentSubmissions') ? {} : { courseWork: [{ id: 'w-c5' }] }));
    }
    const r = await result;
    expect(r.work.map((w) => w.id)).toEqual(['w-c1', 'w-c2', 'w-c3', 'w-c4', 'w-c5']);
  });

  it('maps 403 with an insufficient scope to denied', async () => {
    g.fetch = jest.fn().mockResolvedValue(
      fail(403, {
        code: 403,
        status: 'PERMISSION_DENIED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
          },
        ],
      }),
    );
    await expect(fetchClassroom('t')).rejects.toMatchObject({ kind: 'denied' });
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
