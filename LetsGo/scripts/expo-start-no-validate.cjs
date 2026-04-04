#!/usr/bin/env node
/**
 * Workaround: Expo CLI can throw "Body is unusable: Body has already been read" when
 * validateDependenciesVersions fetches native module versions (cached Response + .json()).
 * EXPO_NO_DEPENDENCY_VALIDATION skips that check; dev server runs normally.
 */
process.env.EXPO_NO_DEPENDENCY_VALIDATION = "1";
const { spawnSync } = require("node:child_process");
const extra = process.argv.slice(2);
const result = spawnSync("npx", ["expo", "start", ...extra], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
