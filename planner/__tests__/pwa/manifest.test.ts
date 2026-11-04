import fs from "fs";
import path from "path";

const root = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("web manifest", () => {
  const manifest = JSON.parse(read("public/manifest.json"));

  it("has the installable-app fields", () => {
    expect(manifest).toMatchObject({
      name: "Study Planner",
      short_name: "Planner",
      description: "Your university timetable, homework and notes.",
      display: "standalone",
      background_color: "#F4F6F8",
      theme_color: "#F4F6F8",
      start_url: "/",
      scope: "/",
    });
  });

  it("does not lock the orientation", () => {
    expect(manifest.orientation).toBeUndefined();
  });

  it("lists 192, 512 and maskable icons that exist on disk", () => {
    const find = (sizes: string, purpose: string) =>
      manifest.icons.find(
        (i: any) => i.sizes === sizes && i.purpose === purpose,
      );
    expect(find("192x192", "any")).toBeTruthy();
    expect(find("512x512", "any")).toBeTruthy();
    expect(find("512x512", "maskable")).toBeTruthy();
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(fs.existsSync(path.join(root, "public", icon.src))).toBe(true);
    }
  });

  it("ships a 180x180 apple touch icon", () => {
    const png = fs.readFileSync(
      path.join(root, "public/icons/apple-touch-icon.png"),
    );
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});

describe("html template", () => {
  const html = read("public/index.html");
  it.each([
    '<link rel="manifest" href="/manifest.json">',
    '<meta name="theme-color" content="#F4F6F8">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Planner">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    "viewport-fit=cover",
    "serviceWorker",
    "register('/sw.js')",
    "%LANG_ISO_CODE%",
    "%WEB_TITLE%",
    'id="root"',
  ])("contains %s", (needle) => {
    expect(html).toContain(needle);
  });
});

describe("firebase.json", () => {
  const cfg = JSON.parse(read("firebase.json"));
  it("keeps firestore rules", () => {
    expect(cfg.firestore).toEqual({ rules: "firestore.rules" });
  });
  it("hosts dist with an SPA rewrite and cache headers", () => {
    expect(cfg.hosting.public).toBe("dist");
    expect(cfg.hosting.rewrites).toContainEqual({
      source: "**",
      destination: "/index.html",
    });
    const h = (source: string) =>
      cfg.hosting.headers.find((x: any) => x.source === source)?.headers;
    expect(h("/sw.js")).toContainEqual({
      key: "Cache-Control",
      value: "no-cache",
    });
    expect(h("/_expo/static/**")).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });
  });
});
