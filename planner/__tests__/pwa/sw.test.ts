import fs from 'fs';
import path from 'path';
import vm from 'vm';

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

function load(extra: Record<string, unknown> = {}) {
  const ctx: any = { self: {}, URL, Promise, console, Response, ...extra };
  vm.createContext(ctx);
  vm.runInContext(
    src +
      '\n;this.strategyFor = strategyFor; this.CACHE = CACHE_NAME; this.offlineResponse = offlineResponse;',
    ctx,
  );
  return ctx;
}

const origin = 'https://planner.web.app';
const req = (method = 'GET', mode = 'same-origin') => ({ method, mode });

describe('service worker strategyFor', () => {
  const { strategyFor, CACHE } = load();

  it('names the cache with the planner- prefix the activate cleanup matches', () => {
    expect(CACHE).toMatch(/^planner-/);
  });
  it('is network-first for navigations', () => {
    expect(strategyFor(new URL(origin + '/week'), req('GET', 'navigate'), origin)).toBe(
      'network-first',
    );
  });
  it('is cache-first for hashed build output', () => {
    expect(strategyFor(new URL(origin + '/_expo/static/js/web/entry-abc.js'), req(), origin)).toBe(
      'cache-first',
    );
    expect(strategyFor(new URL(origin + '/assets/font.ttf'), req(), origin)).toBe('cache-first');
  });
  it('revalidates the manifest and icons in the background', () => {
    for (const p of ['/manifest.json', '/icons/icon-192.png']) {
      expect(strategyFor(new URL(origin + p), req(), origin)).toBe('stale-while-revalidate');
    }
  });
  it('bypasses the Firebase Auth handler, cross-origin and non-GET', () => {
    expect(strategyFor(new URL(origin + '/__/auth/handler'), req('GET', 'navigate'), origin)).toBe(
      'bypass',
    );
    expect(
      strategyFor(
        new URL('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen'),
        req(),
        origin,
      ),
    ).toBe('bypass');
    expect(strategyFor(new URL(origin + '/week'), req('POST', 'navigate'), origin)).toBe('bypass');
  });
  it('bypasses other same-origin requests it does not know', () => {
    expect(strategyFor(new URL(origin + '/api/x'), req(), origin)).toBe('bypass');
  });
  it('adds no listeners without a registration', () => {
    expect(() => load()).not.toThrow();
  });
});

describe('service worker fetch handler', () => {
  let fetchMock: jest.Mock;
  function setup(cached: unknown) {
    const listeners: Record<string, (e: any) => void> = {};
    const caches = {
      match: jest.fn().mockResolvedValue(cached),
      open: jest.fn().mockResolvedValue({ put: jest.fn() }),
    };
    const self: any = {
      registration: {},
      location: { origin },
      addEventListener: (t: string, fn: (e: any) => void) => (listeners[t] = fn),
    };
    fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
    load({ self, caches, fetch: fetchMock });
    return listeners;
  }
  const navigate = () => {
    let responded: Promise<Response> | undefined;
    return {
      event: {
        request: { url: origin + '/week', method: 'GET', mode: 'navigate' },
        respondWith: (p: Promise<Response>) => (responded = p),
        waitUntil: jest.fn(),
      },
      get: () => responded,
    };
  };

  it('answers an offline first visit with a plain 503', async () => {
    const l = setup(undefined);
    const n = navigate();
    l.fetch(n.event);
    const res = await n.get()!;
    expect(res.status).toBe(503);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe(
      'You\u2019re offline and the app hasn\u2019t been saved yet. Open it once while online.',
    );
  });

  it('revalidates navigations past the browser HTTP cache', async () => {
    const l = setup(undefined);
    const n = navigate();
    l.fetch(n.event);
    await n.get();
    expect(fetchMock).toHaveBeenCalledWith(n.event.request, { cache: 'no-cache' });
  });

  it('falls back to the cached shell when offline', async () => {
    const shell = new Response('shell');
    const l = setup(shell);
    const n = navigate();
    l.fetch(n.event);
    expect(await n.get()).toBe(shell);
  });
});

describe('service worker activate and cache-first', () => {
  function setup(opts: { keys?: string[]; cached?: unknown; response?: Response } = {}) {
    const listeners: Record<string, (e: any) => void> = {};
    const put = jest.fn().mockResolvedValue(undefined);
    const caches = {
      keys: jest.fn().mockResolvedValue(opts.keys ?? []),
      delete: jest.fn().mockResolvedValue(true),
      match: jest.fn().mockResolvedValue(opts.cached),
      open: jest.fn().mockResolvedValue({ put }),
    };
    const claim = jest.fn().mockResolvedValue(undefined);
    const self: any = {
      registration: {},
      location: { origin },
      clients: { claim },
      addEventListener: (t: string, fn: (e: any) => void) => (listeners[t] = fn),
    };
    load({ self, caches, fetch: jest.fn().mockResolvedValue(opts.response) });
    return { listeners, caches, put, claim };
  }

  it('deletes older planner caches on activate and keeps the current one', async () => {
    const { listeners, caches, claim } = setup({
      keys: ['planner-v1', 'planner-dev', 'other-app'],
    });
    let waited: Promise<unknown> | undefined;
    listeners.activate({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
    expect(caches.delete).toHaveBeenCalledTimes(1);
    expect(caches.delete).toHaveBeenCalledWith('planner-v1');
    expect(claim).toHaveBeenCalled();
  });

  it('stores a fetched bundle inside waitUntil', async () => {
    const { listeners, put } = setup({ response: new Response('js') });
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    const request = {
      url: origin + '/_expo/static/js/web/entry-abc.js',
      method: 'GET',
      mode: 'no-cors',
    };
    listeners.fetch({
      request,
      respondWith: (p: Promise<Response>) => (responded = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await responded;
    expect(waits).toHaveLength(1);
    await Promise.all(waits);
    expect(put).toHaveBeenCalledWith(request, expect.any(Response));
  });

  it('never stores an HTML page as a static file (a missing asset rewritten to index.html)', async () => {
    const html = new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });
    const { listeners, put } = setup({ response: html });
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    listeners.fetch({
      request: { url: origin + '/assets/fonts/a.ttf', method: 'GET', mode: 'cors' },
      respondWith: (p: Promise<Response>) => (responded = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await responded;
    await Promise.all(waits);
    expect(put).not.toHaveBeenCalled();
  });
});

describe('service worker install', () => {
  it('precaches the shell with Requests that skip the HTTP cache', async () => {
    const listeners: Record<string, (e: any) => void> = {};
    const addAll = jest.fn().mockResolvedValue(undefined);
    const caches = { open: jest.fn().mockResolvedValue({ addAll }) };
    const skipWaiting = jest.fn().mockResolvedValue(undefined);
    const self: any = {
      registration: {},
      location: { origin },
      skipWaiting,
      addEventListener: (t: string, fn: (e: any) => void) => (listeners[t] = fn),
    };
    // Node's Request needs absolute URLs; a worker resolves relative ones against its scope.
    const ScopedRequest = function (u: string, init?: RequestInit) {
      return new Request(new URL(u, origin).href, init);
    };
    load({ self, caches, Request: ScopedRequest });
    let waited: Promise<unknown> | undefined;
    listeners.install({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
    const arg = addAll.mock.calls[0][0] as Request[];
    expect(arg.map((r) => new URL(r.url).pathname)).toEqual(['/', '/manifest.json']);
    for (const r of arg) {
      expect(r).toBeInstanceOf(Request);
      expect(r.cache).toBe('reload');
    }
    expect(skipWaiting).toHaveBeenCalled();
  });
});
