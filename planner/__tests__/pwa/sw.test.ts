import fs from "fs";
import path from "path";
import vm from "vm";

const src = fs.readFileSync(
  path.join(__dirname, "..", "..", "public", "sw.js"),
  "utf8",
);

function load(extra: Record<string, unknown> = {}) {
  const ctx: any = { self: {}, URL, Promise, console, Response, ...extra };
  vm.createContext(ctx);
  vm.runInContext(
    src +
      "\n;this.strategyFor = strategyFor; this.CACHE = CACHE_NAME; this.offlineResponse = offlineResponse;",
    ctx,
  );
  return ctx;
}

const origin = "https://planner.web.app";
const req = (method = "GET", mode = "same-origin") => ({ method, mode });

describe("service worker strategyFor", () => {
  const { strategyFor, CACHE } = load();

  it("names the cache planner-v1", () => {
    expect(CACHE).toBe("planner-v1");
  });
  it("is network-first for navigations", () => {
    expect(
      strategyFor(new URL(origin + "/week"), req("GET", "navigate"), origin),
    ).toBe("network-first");
  });
  it("is cache-first for hashed build output", () => {
    expect(
      strategyFor(
        new URL(origin + "/_expo/static/js/web/entry-abc.js"),
        req(),
        origin,
      ),
    ).toBe("cache-first");
    expect(
      strategyFor(new URL(origin + "/assets/font.ttf"), req(), origin),
    ).toBe("cache-first");
  });
  it("revalidates the manifest and icons in the background", () => {
    for (const p of ["/manifest.json", "/icons/icon-192.png"]) {
      expect(strategyFor(new URL(origin + p), req(), origin)).toBe(
        "stale-while-revalidate",
      );
    }
  });
  it("bypasses the Firebase Auth handler, cross-origin and non-GET", () => {
    expect(
      strategyFor(
        new URL(origin + "/__/auth/handler"),
        req("GET", "navigate"),
        origin,
      ),
    ).toBe("bypass");
    expect(
      strategyFor(
        new URL(
          "https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen",
        ),
        req(),
        origin,
      ),
    ).toBe("bypass");
    expect(
      strategyFor(new URL(origin + "/week"), req("POST", "navigate"), origin),
    ).toBe("bypass");
  });
  it("bypasses other same-origin requests it does not know", () => {
    expect(strategyFor(new URL(origin + "/api/x"), req(), origin)).toBe(
      "bypass",
    );
  });
  it("adds no listeners without a registration", () => {
    expect(() => load()).not.toThrow();
  });
});

describe("service worker fetch handler", () => {
  function setup(cached: unknown) {
    const listeners: Record<string, (e: any) => void> = {};
    const caches = {
      match: jest.fn().mockResolvedValue(cached),
      open: jest.fn().mockResolvedValue({ put: jest.fn() }),
    };
    const self: any = {
      registration: {},
      location: { origin },
      addEventListener: (t: string, fn: (e: any) => void) =>
        (listeners[t] = fn),
    };
    load({
      self,
      caches,
      fetch: jest.fn().mockRejectedValue(new Error("offline")),
    });
    return listeners;
  }
  const navigate = () => {
    let responded: Promise<Response> | undefined;
    return {
      event: {
        request: { url: origin + "/week", method: "GET", mode: "navigate" },
        respondWith: (p: Promise<Response>) => (responded = p),
        waitUntil: jest.fn(),
      },
      get: () => responded,
    };
  };

  it("answers an offline first visit with a plain 503", async () => {
    const l = setup(undefined);
    const n = navigate();
    l.fetch(n.event);
    const res = await n.get()!;
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(
      "You\u2019re offline and the app hasn\u2019t been saved yet. Open it once while online.",
    );
  });

  it("falls back to the cached shell when offline", async () => {
    const shell = new Response("shell");
    const l = setup(shell);
    const n = navigate();
    l.fetch(n.event);
    expect(await n.get()).toBe(shell);
  });
});
