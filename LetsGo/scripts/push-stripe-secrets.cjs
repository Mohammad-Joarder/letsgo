/**
 * Pushes Phase 5 Stripe-related secrets to the linked Supabase project (Edge Functions).
 *
 * Prerequisites:
 *   - Supabase CLI available (via npx supabase or global `supabase`)
 *   - Project linked: run `npx supabase link` from this repo's LetsGo folder once
 *
 * Usage:
 *   npm run secrets:stripe
 *   npm run secrets:stripe -- --project-ref your_project_ref
 *
 * Reads only keys starting with STRIPE_ from supabase/.env.stripe (gitignored).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const srcFile = path.join(root, "supabase", ".env.stripe");

function parseEnvStripe(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!key.startsWith("STRIPE_")) {
      console.warn(`[secrets:stripe] Skipping non-STRIPE key: ${key}`);
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out.push(`${key}=${value}`);
  }
  return out.join("\n") + "\n";
}

function main() {
  const extraArgs = process.argv.slice(2);

  if (!fs.existsSync(srcFile)) {
    console.error(
      `[secrets:stripe] Missing ${path.relative(root, srcFile)}\n` +
        "  Copy supabase/.env.stripe.example to supabase/.env.stripe and add your Stripe values."
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(srcFile, "utf8");
  const filtered = parseEnvStripe(raw).trim();
  if (!filtered) {
    console.error("[secrets:stripe] No STRIPE_* entries found in supabase/.env.stripe");
    process.exit(1);
  }

  const tmp = path.join(os.tmpdir(), `letsgo-stripe-secrets-${process.pid}.env`);
  fs.writeFileSync(tmp, filtered, "utf8");

  try {
    const args = ["supabase", "secrets", "set", "--env-file", tmp, ...extraArgs];
    const r = spawnSync("npx", args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env },
    });
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
    console.log("[secrets:stripe] Done. Verify in Supabase Dashboard → Edge Functions → Secrets.");
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

main();
