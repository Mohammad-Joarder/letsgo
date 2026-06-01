/**
 * Driver registration / compliance feature flags.
 * Keys must match `app_feature_flags.flag_key` in Supabase (migration 015).
 *
 * Toggle in production: Supabase SQL editor or Table Editor — update `enabled` on `app_feature_flags`.
 * Local / CI overrides: `EXPO_PUBLIC_DRIVER_FF_OVERRIDES` (JSON object of flag_key → boolean).
 */

export const DRIVER_REGISTRATION_FLAG_KEYS = [
  "driver_email_verification_gate",
  "driver_abn_validation",
  "driver_vehicle_docs_enhanced",
  "admin_compliance_dashboard",
  "driver_periodic_selfie_reverification",
  "driver_expiry_monitoring_engine",
  "driver_fraud_detection",
  "driver_device_fingerprinting",
  "driver_audit_logging",
] as const;

export type DriverRegistrationFlagKey = (typeof DRIVER_REGISTRATION_FLAG_KEYS)[number];

export type DriverRegistrationFeatureFlags = Record<DriverRegistrationFlagKey, boolean>;

export const DEFAULT_DRIVER_REGISTRATION_FEATURE_FLAGS: DriverRegistrationFeatureFlags =
  DRIVER_REGISTRATION_FLAG_KEYS.reduce((acc, k) => {
    acc[k] = false;
    return acc;
  }, {} as DriverRegistrationFeatureFlags);

export function parseDriverFfOverridesFromEnv(raw: string | undefined): Partial<DriverRegistrationFeatureFlags> {
  if (!raw?.trim()) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object") return {};
    const out: Partial<DriverRegistrationFeatureFlags> = {};
    for (const k of DRIVER_REGISTRATION_FLAG_KEYS) {
      if (k in obj) out[k] = Boolean((obj as Record<string, unknown>)[k]);
    }
    return out;
  } catch {
    if (__DEV__) {
      console.warn("[LetsGo] EXPO_PUBLIC_DRIVER_FF_OVERRIDES is not valid JSON; ignoring.");
    }
    return {};
  }
}
