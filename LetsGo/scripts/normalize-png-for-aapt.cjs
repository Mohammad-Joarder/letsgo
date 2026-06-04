/**
 * Re-encode every PNG under ./assets for Android AAPT2 (mergeReleaseResources).
 * Metro embeds these as drawables; non–sRGB ICC / odd PNG modes can fail with:
 *   AAPT: error: file failed to compile
 *
 * Run after adding or replacing any PNG under assets/:
 *   node scripts/normalize-png-for-aapt.cjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");

function walkPngs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPngs(full, out);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".png")) out.push(full);
  }
}

async function normalizeOne(filePath) {
  const tmp = `${filePath}.aapt-tmp.png`;
  await sharp(filePath)
    .rotate()
    .ensureAlpha()
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(tmp);
  fs.renameSync(tmp, filePath);
}

async function main() {
  const list = [];
  walkPngs(ASSETS, list);
  if (list.length === 0) {
    console.log("No PNGs under assets/");
    return;
  }
  for (const p of list) {
    await normalizeOne(p);
    console.log("OK", path.relative(ROOT, p));
  }
  console.log(`\nNormalized ${list.length} PNG(s). Commit changes before EAS Android build.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
