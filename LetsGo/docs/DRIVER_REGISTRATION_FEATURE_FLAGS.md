# Driver registration — feature flags and roadmap

This app uses **Supabase** for authentication and storage. Product requirements that mention **Firebase** (email verification) map to the same gates here using **Supabase Auth** where applicable.

## Remote flags

- **Table:** `public.app_feature_flags` (`flag_key`, `enabled`, `description`, `updated_at`).
- **Who can read:** everyone (RLS `SELECT` allowed) so the mobile app can load flags before heavy flows run.
- **Who can write:** admins only (`public.is_admin()`), via Supabase Dashboard **Table Editor** or SQL.
- **Local / EAS overrides:** set `EXPO_PUBLIC_DRIVER_FF_OVERRIDES` to a JSON object, for example:

  `{"driver_email_verification_gate":true,"driver_abn_validation":true}`

  Keys must match `lib/driverRegistrationFeatureFlags.ts`. Overrides win over remote values for keys present in the JSON.

Apply migration `015_app_feature_flags_and_driver_verification.sql` before relying on remote driver feature flags.

## Flag keys (summary)

| Flag | Purpose (high level) |
|------|----------------------|
| `driver_email_verification_gate` | Block step 1 until `auth.users.email_confirmed_at` is set (Supabase email confirmation). |
| `driver_abn_validation` | ABR JSON lookup on vehicle step; persists `abn`, entity display, GST, `abn_verified_at`. |
| `driver_vehicle_docs_enhanced` | Future: extra docs, OCR expiry, admin states. |
| `admin_compliance_dashboard` | Future: admin queues, filters, audit UI. |
| `driver_periodic_selfie_reverification` | Future: periodic / suspicious-login reverification. |
| `driver_expiry_monitoring_engine` | Future: scheduled jobs + reminders (partial client helpers may already exist). |
| `driver_fraud_detection` | Future: duplicate / risk scoring. |
| `driver_device_fingerprinting` | Future: FingerprintJS-style signals. |
| `driver_audit_logging` | Future: immutable audit trail. |

**Removed from the app contract (legacy DB rows may still exist):** `driver_license_ocr`, `driver_selfie_face_match`. Licence photos and `driver_selfie` are **upload-only**; admins review all uploads in the **driver approval modal** on **`/(auth)/admin-compliance`** (signed URLs + per-document checklist).

## Requirements vs current implementation

1. **Email verification** — **Implemented when flag on.** Uses Supabase `user.email_confirmed_at`. Resend uses `resendSignupConfirmationEmail` → `auth.resend({ type: "signup", email })`. Block onboarding step 1 until verified when `driver_email_verification_gate` is true.

2. **Licence photos** — **Upload only** (front + back). Drivers enter licence number and expiry manually. No automatic OCR gate in the app or `submit-driver-onboarding`.

3. **Driver selfie** — **Upload only** for safety; no automatic face match. Step 6 requires `profile_photo` + `driver_selfie`; submit requires `driver_selfie`. Manual review uses signed URLs in the admin compliance queue.

4. **ABN validation** — **Implemented** when flag on: vehicle step + Edge `abr-lookup-abn` with `persist: true`.

5. **Vehicle documents** — **Enhanced** when flag on: `vehicle_inspection` document type + `vehicle_inspection_expiry` on `drivers`.

6. **Manual compliance dashboard** — **Implemented in app** for admins: `/(auth)/admin-compliance` (**modal** document review + checklist) + Edge `admin-compliance-drivers`, **`admin-compliance-driver-detail`** (signed URLs for all standard doc slots), `admin-compliance-action`.

7–11. **P1 items** — **Partially wired:** fraud scan + device fingerprint + audit on submit; expiry cron Edge; periodic selfie uses DB column `selfie_reverification_due_at` (set via ops). See `docs/COMPLIANCE_RELEASE_CHECKLIST.md`.

## App entry points

- `context/FeatureFlagsContext.tsx` — loads `app_feature_flags` + merges env overrides.
- `hooks/useDriverRegistrationFeatureFlags.ts` — typed access for screens.
- `lib/driverOnboardingCompletion.ts` — step 1 gates when flags + session/profile state require it.
- `app/(driver)/onboarding/verification-hub.tsx` — driver-facing verification status and email resend.

## Ops notes

- **Release steps:** `docs/COMPLIANCE_RELEASE_CHECKLIST.md` (migration `016`, deploy Edge functions, Twilio, ABR GUID, cron secret).
- Turning **on** `driver_email_verification_gate` requires working Supabase confirmation emails.
