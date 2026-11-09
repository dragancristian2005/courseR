/* Post-export step: gives dist/sw.js a cache name that changes whenever the built bundles change.
 * A new name changes the worker's bytes, so browsers install it and its activate handler deletes
 * the previous planner-* cache (and with it the old hashed bundles). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PLACEHOLDER = "var CACHE_NAME = 'planner-dev';";

function listFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? listFiles(path.join(dir, e.name), base)
        : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')],
    )
    .sort();
}

function cacheNameFor(files) {
  const hash = crypto.createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10);
  return `planner-${hash}`;
}

function stampSource(source, files) {
  if (!source.includes(PLACEHOLDER)) {
    throw new Error(`sw.js does not contain ${PLACEHOLDER}`);
  }
  return source.replace(PLACEHOLDER, `var CACHE_NAME = '${cacheNameFor(files)}';`);
}

function main(dist = path.join(__dirname, '..', 'dist')) {
  const swPath = path.join(dist, 'sw.js');
  const staticDir = path.join(dist, '_expo', 'static');
  if (!fs.existsSync(swPath)) {
    throw new Error(`stamp-sw: ${swPath} not found. Run "expo export -p web" first.`);
  }
  if (!fs.existsSync(staticDir)) {
    throw new Error(`stamp-sw: ${staticDir} not found. Run "expo export -p web" first.`);
  }
  const out = stampSource(fs.readFileSync(swPath, 'utf8'), listFiles(staticDir));
  fs.writeFileSync(swPath, out);
  console.log(`stamp-sw: ${out.match(/planner-[0-9a-f]{10}/)[0]}`);
}

module.exports = { cacheNameFor, stampSource, listFiles, main };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
