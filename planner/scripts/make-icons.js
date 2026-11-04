/* Generates the Orar app icons into public/icons. Pure Node, no dependencies.
 * Run with: npm run icons */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const INK = [0x17, 0x21, 0x3a];
const PAPER = [0xf4, 0xf6, 0xf8];
const SEMINAR = [0xf6, 0xd9, 0xb0];
const NOW = [0xc8, 0x30, 0x2a];

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgb) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgb.copy(raw, y * stride + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Draws the mark. `margin` is the fraction of the size kept clear around the grid. */
function draw(size, margin) {
  const px = Buffer.alloc(size * size * 3);
  const rect = (x0, y0, x1, y1, c) => {
    for (
      let y = Math.max(0, Math.round(y0));
      y < Math.min(size, Math.round(y1));
      y++
    ) {
      for (
        let x = Math.max(0, Math.round(x0));
        x < Math.min(size, Math.round(x1));
        x++
      ) {
        const i = (y * size + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  };
  rect(0, 0, size, size, INK);

  const g0 = size * margin;
  const g1 = size * (1 - margin);
  const span = g1 - g0;
  const cell = span / 3;
  const t = Math.max(2, size / 56); // line thickness

  // One seminar-coloured cell (middle column, top row).
  rect(g0 + cell, g0, g0 + 2 * cell, g0 + cell, SEMINAR);

  // 3 x 3 grid: four vertical and four horizontal paper lines.
  for (let i = 0; i <= 3; i++) {
    const p = g0 + i * cell;
    rect(p - t / 2, g0 - t / 2, p + t / 2, g1 + t / 2, PAPER);
    rect(g0 - t / 2, p - t / 2, g1 + t / 2, p + t / 2, PAPER);
  }

  // The red "now" line through the middle row, overshooting the grid slightly.
  const mid = g0 + 1.5 * cell;
  const over = size * 0.04;
  rect(g0 - over, mid - t, g1 + over, mid + t, NOW);
  return px;
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, 0.2],
  ["icon-512.png", 512, 0.2],
  ["apple-touch-icon.png", 180, 0.2],
  // Maskable: keep the mark inside the central 60% so any mask shape leaves it intact.
  ["icon-maskable-512.png", 512, 0.3],
];
for (const [name, size, margin] of targets) {
  fs.writeFileSync(
    path.join(outDir, name),
    encodePng(size, draw(size, margin)),
  );
  console.log("wrote", name);
}
