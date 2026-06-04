# Android EAS build troubleshooting

## “Bundle JavaScript” / Metro failures (unknown error)

If the failure is in **Bundle JavaScript** (not Run gradlew), reproduce locally:

```bash
npm run bundle:check:android
```

(`expo export --platform android` — same step EAS runs for the Android JS bundle.)

### Fixes applied in this repo

1. **`babel-preset-expo`** is a **direct** `dependency` (not only nested under `expo`).
2. **`babel.config.js`** uses **`require.resolve(...)`** for `babel-preset-expo`, `nativewind/babel`, and `react-native-reanimated/plugin` so Babel always resolves from the project root on **EAS Linux** (Windows hoisting can hide this bug locally until you `expo export`).
3. **`@babel/core`** and **`react-refresh`** are **dependencies** so Metro’s transform worker always has them (avoids edge cases where dev-only installs differ on CI).
4. **`eas.json`** sets **`NODE_OPTIONS=--max-old-space-size=8192`** under **Android only** (`build.*.android.env`) to reduce spurious bundle failures from heap limits — **iOS builds do not use** that `android.env` block.

After pulling changes: **`npm install`**, commit **`package-lock.json`**, then **`eas build --platform android --clear-cache`** once.

---

## AAPT2 / `mergeReleaseResources` — `file failed to compile` on a `.png`

Example:

```text
ERROR: .../drawable-mdpi/assets_images_brand_logofull.png: AAPT: error: file failed to compile.
Execution failed for task ':app:mergeReleaseResources'.
```

Metro copies **`require()`’d images** into Android `drawable-*`. **AAPT2** is strict: some PNGs (unusual ICC profile, color space, or encoding) work on desktop but **fail at compile time** on Linux/EAS.

**Fix in this repo**

1. **`npm run postinstall`** runs `generate-app-icons`, which **re-encodes** `assets/images/brand/logo-full.png` to standard **sRGB 8-bit RGBA** before generating icons.
2. **`npm run normalize:png-aapt`** re-encodes **every** `assets/**/*.png` the same way — run after adding/replacing any PNG asset.

Then commit the updated binaries and rebuild Android.

---

## “Gradle build failed with unknown error”

Expo often surfaces Gradle failures as a generic message. The real error is always in **Expo → your build → Run gradlew** (expand the failed step and scroll for `FAILURE: Build failed`).

## Quick checks (in order)

1. **Align Expo packages** (after pulling):

   ```bash
   npx expo install --fix
   npx expo-doctor
   ```

2. **Clean EAS cache** (fixes many stale native cache issues):

   ```bash
   eas build --profile preview --platform android --clear-cache
   ```

3. **Common log patterns**
   - **`No matching variant` / `AgpVersionAttr` / `No variants exist`** — SDK 54 + EAS image / autolinking. This repo pins **`kotlinVersion`** via `expo-build-properties` in `app.config.js`. If it still fails, try another `--clear-cache` build after `npx expo install --fix`.
   - **`google-services.json`** — only if you add Firebase FCM; not required for the current Lets Go config unless you add that plugin.
   - **Out of memory** — rare on EAS; logs mention `Java heap space`. Retry or use a larger EAS resource class if configured.

4. **Local reproduction** (optional):

   ```bash
   npx expo prebuild --platform android --clean
   cd android && ./gradlew assembleRelease
   ```

   Use the same JDK/AGP hints as EAS; local success with EAS failure often points to cache or image drift — use `--clear-cache`.
