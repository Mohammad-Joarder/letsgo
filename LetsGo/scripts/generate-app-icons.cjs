/**
 * Generates EAS / App Store / Play Store icon & splash assets from brand artwork.
 * Source: assets/images/brand/logo-full.png (full lockup)
 *
 * Run: npm run generate:icons
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "assets", "images", "brand", "logo-full.png");
const STORE_DIR = path.join(ROOT, "assets", "store");

const ICON_BG = "#FFFFFF";
const SPLASH_BG = "#FFFFFF";
const NOTIFICATION_TINT = "#00D4AA";

async function ensureSource() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing brand source image: ${SOURCE}`);
  }
}

/**
 * Re-encode the brand PNG so Android AAPT2 accepts it. Metro copies `require()`'d images
 * into `drawable-*`; unusual ICC / color space / PNG encoding can trigger:
 * `AAPT: error: file failed to compile` on :app:mergeReleaseResources.
 */
async function normalizeSourceForAapt() {
  const tmp = `${SOURCE}.tmp.png`;
  await sharp(SOURCE)
    .rotate()
    .ensureAlpha()
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(tmp);
  fs.renameSync(tmp, SOURCE);
}

/** Square app icon with solid background (iOS / generic). */
async function writeSquareIcon(size, outPath, background, paddingRatio = 0.14) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

/** Android adaptive foreground — transparent canvas, logo centered in safe zone. */
async function writeAdaptiveForeground(size, outPath) {
  const inner = Math.round(size * 0.56);
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

/** Splash / marketing logo on transparent PNG (placed on backgroundColor in app.config). */
async function writeSplashLogo(maxWidth, outPath) {
  const logo = await sharp(SOURCE).resize(maxWidth, null, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

/** Full-screen splash frame (legacy / optional). */
async function writeFullSplash(width, height, outPath) {
  const logoWidth = Math.round(width * 0.7);
  const logo = await sharp(SOURCE).resize(logoWidth, null, { fit: "inside" }).png().toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: SPLASH_BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

/** Android notification icon — white glyph on transparent (required shape). */
async function writeNotificationIcon(size, outPath) {
  const inner = Math.round(size * 0.62);
  await sharp(SOURCE)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .flatten({ background: "#ffffff" })
    .negate()
    .threshold(200)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
}

async function main() {
  await ensureSource();
  await normalizeSourceForAapt();
  fs.mkdirSync(STORE_DIR, { recursive: true });

  const tasks = [
    ["icon.png (1024)", () => writeSquareIcon(1024, path.join(ROOT, "assets", "icon.png"), ICON_BG)],
    [
      "adaptive-icon.png (1024)",
      () => writeAdaptiveForeground(1024, path.join(ROOT, "assets", "adaptive-icon.png")),
    ],
    ["favicon.png (48)", () => writeSquareIcon(48, path.join(ROOT, "assets", "favicon.png"), ICON_BG, 0.1)],
    [
      "splash-icon.png",
      () => writeSplashLogo(900, path.join(ROOT, "assets", "splash-icon.png")),
    ],
    [
      "splash.png (1284×2778)",
      () => writeFullSplash(1284, 2778, path.join(ROOT, "assets", "splash.png")),
    ],
    [
      "notification-icon.png (96)",
      () => writeNotificationIcon(96, path.join(ROOT, "assets", "notification-icon.png")),
    ],
    [
      "store/icon-1024.png",
      () => writeSquareIcon(1024, path.join(STORE_DIR, "icon-1024.png"), ICON_BG),
    ],
    [
      "store/icon-512.png (Play listing)",
      () => writeSquareIcon(512, path.join(STORE_DIR, "icon-512.png"), ICON_BG),
    ],
  ];

  for (const [label, fn] of tasks) {
    await fn();
    console.log(`✓ ${label}`);
  }

  console.log("\nDone. Commit assets/*.png before EAS build (also regenerated on npm install via postinstall).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
