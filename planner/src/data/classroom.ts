import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { chooseSignInMethod, type BrowserEnv } from './auth';
import { initClassroomAuth } from './firebase';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];
const API = 'https://classroom.googleapis.com/v1';
const REDIRECT_FLAG = 'planner.classroomRedirect';

export type ClassroomErrorKind = 'denied' | 'blocked' | 'popupBlocked' | 'network' | 'other';

const MESSAGES: Record<ClassroomErrorKind, string> = {
  denied: 'Classroom access wasn’t allowed.',
  blocked: 'Your school’s Google account doesn’t allow this app to read Classroom.',
  popupBlocked:
    'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  network: 'Couldn’t reach Google Classroom. Check your connection and try again.',
  other: 'Something went wrong reading Classroom. Try again.',
};

export class ClassroomError extends Error {
  constructor(public kind: ClassroomErrorKind) {
    super(MESSAGES[kind]);
    this.name = 'ClassroomError';
  }
}

const DENIED_CODES = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
  'auth/access-denied',
];

function mapAuthError(e: unknown): ClassroomError {
  if (e instanceof ClassroomError) return e;
  const code = (e as { code?: unknown } | null)?.code;
  const message = e instanceof Error ? e.message : '';
  if (typeof code === 'string' && DENIED_CODES.includes(code)) return new ClassroomError('denied');
  if (message.includes('access_denied')) return new ClassroomError('denied');
  if (code === 'auth/popup-blocked') return new ClassroomError('popupBlocked');
  if (code === 'auth/network-request-failed') return new ClassroomError('network');
  return new ClassroomError('other');
}

function storage(): Storage | null {
  try {
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

function provider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  SCOPES.forEach((s) => p.addScope(s));
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

async function signOutQuietly(auth: Auth) {
  try {
    await signOut(auth);
  } catch {
    // best effort: the session-only persistence ends with the tab anyway
  }
}

/**
 * Sets up the Classroom auth before the student taps Connect. Safari opens the Google window
 * only straight from the tap, and Firebase would otherwise load its helper frame first.
 * Never throws: a setup problem shows up when Connect is tapped.
 */
export function prepareClassroomSignIn(): void {
  if (Platform.OS !== 'web') return;
  try {
    initClassroomAuth();
  } catch {
    // reported by getClassroomToken
  }
}

/**
 * Asks Google for read-only Classroom access, as any Google account, on a separate Firebase
 * app so the planner sign-in is untouched. Returns the token, or 'redirecting' when the page
 * is leaving (installed app); the token then comes back through takeClassroomToken().
 */
export async function getClassroomToken(): Promise<string | 'redirecting'> {
  if (Platform.OS !== 'web') {
    throw new Error('Importing from Classroom on this device arrives with the native app.');
  }
  try {
    const auth = initClassroomAuth();
    const env = globalThis as unknown as BrowserEnv;
    if (
      chooseSignInMethod({
        matchMedia: env.matchMedia?.bind(env),
        navigator: (env as any).navigator,
      }) === 'redirect'
    ) {
      try {
        storage()?.setItem(REDIRECT_FLAG, '1');
      } catch {
        // without the flag the token cannot be picked up; the redirect still proceeds
      }
      try {
        await signInWithRedirect(auth, provider());
      } catch (e) {
        try {
          storage()?.removeItem(REDIRECT_FLAG);
        } catch {
          // a stale flag only costs one empty getRedirectResult later
        }
        throw e;
      }
      return 'redirecting';
    }
    // Nothing may be awaited before this call, or Safari blocks the window.
    const result = await signInWithPopup(auth, provider());
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    await signOutQuietly(auth);
    if (!token) throw new ClassroomError('other');
    return token;
  } catch (e) {
    throw mapAuthError(e);
  }
}

/** Token from a Classroom redirect that just returned, at most once; otherwise null. */
export async function takeClassroomToken(): Promise<string | null> {
  try {
    const store = storage();
    if (!store || store.getItem(REDIRECT_FLAG) !== '1') return null;
    store.removeItem(REDIRECT_FLAG);
  } catch {
    return null;
  }
  try {
    const auth = initClassroomAuth();
    const result = await getRedirectResult(auth);
    const token = result ? GoogleAuthProvider.credentialFromResult(result)?.accessToken : null;
    await signOutQuietly(auth);
    return token ?? null;
  } catch (e) {
    throw mapAuthError(e);
  }
}

export interface ClassroomCourseInfo {
  id: string;
  name: string;
  section: string | null;
}
export interface ClassroomWork {
  id: string;
  courseId: string;
  title: string;
  dueDate: { year: number; month: number; day: number } | null;
  dueTime: { hours?: number; minutes?: number } | null;
  /** When the teacher posted it (RFC 3339, UTC), if Classroom says. */
  created: string | null;
}
export interface ClassroomFetch {
  courses: ClassroomCourseInfo[];
  work: ClassroomWork[];
  /** CourseWork ids the student has turned in (TURNED_IN or RETURNED). */
  turnedIn: Set<string>;
  /** Names of courses that could not be read; they are left out of courses and work. */
  failedCourses: string[];
}

async function getPage(url: string, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ClassroomError('network');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const status = body?.error?.status;
    const details: unknown = body?.error?.details;
    // Google's consent screen lets the student untick a scope: that is a denial, not a block.
    const scopeMissing =
      Array.isArray(details) &&
      details.some((d) => d?.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT');
    if (res.status === 403 && scopeMissing) throw new ClassroomError('denied');
    throw new ClassroomError(
      res.status === 403 && status === 'PERMISSION_DENIED' ? 'blocked' : 'other',
    );
  }
  try {
    return await res.json();
  } catch {
    throw new ClassroomError('other');
  }
}

async function getAll<T>(base: string, key: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const url = pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base;
    const page = await getPage(url, token);
    items.push(...((page?.[key] as T[] | undefined) ?? []));
    pageToken = page?.nextPageToken || undefined;
  } while (pageToken);
  return items;
}

const PARALLEL_COURSES = 4;

/** Runs task over items, at most limit at a time; results keep the order of items. */
async function inPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

type CourseRead = { ok: true; work: any[]; subs: any[] } | { ok: false; error: ClassroomError };

export async function fetchClassroom(token: string): Promise<ClassroomFetch> {
  const rawCourses = await getAll<any>(
    `${API}/courses?studentId=me&courseStates=ACTIVE&pageSize=100`,
    'courses',
    token,
  );
  // The request already asks for ACTIVE courses; drop anything Google still labels otherwise
  // (ARCHIVED, PROVISIONED, DECLINED, SUSPENDED). A course without a state is kept.
  const listed = rawCourses
    .filter((c) => c.courseState === undefined || c.courseState === 'ACTIVE')
    .map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ''),
      section: c.section ? String(c.section) : null,
    }));
  const reads = await inPool(listed, PARALLEL_COURSES, async (c): Promise<CourseRead> => {
    const id = encodeURIComponent(c.id);
    try {
      const [work, subs] = await Promise.all([
        getAll<any>(
          `${API}/courses/${id}/courseWork?courseWorkStates=PUBLISHED&pageSize=100`,
          'courseWork',
          token,
        ),
        getAll<any>(
          `${API}/courses/${id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`,
          'studentSubmissions',
          token,
        ),
      ]);
      return { ok: true, work, subs };
    } catch (e) {
      return { ok: false, error: e instanceof ClassroomError ? e : new ClassroomError('other') };
    }
  });

  // No connection fails everything; a course that can't be read (removed, another school's)
  // is skipped and named, unless no course could be read at all.
  const network = reads.find((r) => !r.ok && r.error.kind === 'network');
  if (network && !network.ok) throw network.error;
  const firstFailure = reads.find((r) => !r.ok);
  if (firstFailure && !firstFailure.ok && reads.every((r) => !r.ok)) throw firstFailure.error;

  const courses: ClassroomCourseInfo[] = [];
  const failedCourses: string[] = [];
  const work: ClassroomWork[] = [];
  const turnedIn = new Set<string>();
  listed.forEach((c, i) => {
    const read = reads[i];
    if (!read.ok) {
      failedCourses.push(c.name);
      return;
    }
    courses.push(c);
    for (const w of read.work) {
      work.push({
        id: String(w.id),
        courseId: c.id,
        title: String(w.title ?? ''),
        dueDate: w.dueDate ?? null,
        dueTime: w.dueTime ?? null,
        created: typeof w.creationTime === 'string' ? w.creationTime : null,
      });
    }
    for (const s of read.subs) {
      if (s.state === 'TURNED_IN' || s.state === 'RETURNED') turnedIn.add(String(s.courseWorkId));
    }
  });
  return { courses, work, turnedIn, failedCourses };
}
