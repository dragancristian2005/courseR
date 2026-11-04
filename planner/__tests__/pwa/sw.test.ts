import fs from "fs";
import path from "path";
import vm from "vm";

const src = fs.readFileSync(
  path.join(__dirname, "..", "..", "public", "sw.js"),
  "utf8",
);

function load() {
  const ctx: any = { self: {}, URL, Promise, console };
  vm.createContext(ctx);
  vm.runInContext(
    src + "\n;this.strategyFor = strategyFor; this.CACHE = CACHE_NAME;",
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
  it("is cache-first for built assets and icons", () => {
    expect(
      strategyFor(
        new URL(origin + "/_expo/static/js/web/entry-abc.js"),
        req(),
        origin,
      ),
    ).toBe("cache-first");
    expect(
      strategyFor(new URL(origin + "/icons/icon-192.png"), req(), origin),
    ).toBe("cache-first");
    expect(
      strategyFor(new URL(origin + "/assets/font.ttf"), req(), origin),
    ).toBe("cache-first");
    expect(strategyFor(new URL(origin + "/manifest.json"), req(), origin)).toBe(
      "cache-first",
    );
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
