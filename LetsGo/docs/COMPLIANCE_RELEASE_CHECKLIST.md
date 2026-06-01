# Driver compliance suite — release checklist

This document covers **database migration `016`**, **new Edge Functions**, **mobile app (Expo)**, **secrets**, and **operational tasks** after implementing the full driver onboarding compliance stack.

---

## 1. Database (Supabase SQL / migrations)

1. Apply migrations in order (at minimum **`015_app_feature_flags_and_driver_verification.sql`** then **`016_driver_compliance_suite.sql`**, then **`017_license_first_issued.sql`** for licence first-issue date).
2. Confirm new objects exist:
   - Columns on `public.drivers` (ABN, OCR, selfie scores, fraud, inspection expiry, etc.).
   - Tables: `compliance_audit_log`, `driver_fraud_signals`, `driver_device_registrations`, `driver_phone_otp_challenges`.
   - Enum values on `document_type`: `vehicle_inspection`, `driver_selfie`.
3. **`016` turns all `app_feature_flags` to `enabled = true`**. For a softer rollout, run after migration:

   ```sql
   update public.app_feature_flags set enabled = false where flag_key in (
     'driver_vehicle_docs_enhanced'
   );
   ```

4. **ABR**: register a free **Authentication GUID** at the Australian Business Register Web Services portal, then set Edge secret **`ABR_AUTHENTICATION_GUID`**.
5. **Device fingerprint**: set **`DEVICE_FINGERPRINT_SALT`**.
6. **Cron / expiry engine**: set **`COMPLIANCE_CRON_SECRET`** (long random). Schedule HTTPS `POST` to  
   `https://<project>.supabase.co/functions/v1/compliance-expiry-scan`  
   with header **`x-compliance-cron-secret: <same value>`** (e.g. every night).
7. **Periodic selfie re-verification**: set `drivers.selfie_reverification_due_at` for approved drivers (SQL or admin tool) when you want the policy active; extend the app home screen later to block trips if overdue (hook is ready at DB level).

---

## 2. Edge Functions — deploy

Deploy all functions (Supabase CLI or Dashboard):

| Function | Role |
|----------|------|
| `abr-lookup-abn` | ABR JSON lookup; `persist: true` writes verified ABN to `drivers` |
| `register-driver-device` | Stores hashed device fingerprint + cross-account signal |
| `evaluate-driver-fraud` | Duplicate licence/ABN/phone scoring |
| `compliance-expiry-scan` | Cron: expiry notifications |
| `admin-compliance-drivers` | Admin queue JSON (compact list + document counts) |
| `admin-compliance-driver-detail` | One driver: profile, vehicle, bank masks, signed URLs for all onboarding docs |
| `admin-compliance-action` | Admin approve / reject / suspend |
| **`submit-driver-onboarding`** (updated) | Enforces flags server-side before `under_review` |

Ensure `supabase/config.toml` entries match deployed names (`verify_jwt = false` where already used for RN).

---

## 3. Mobile app (Expo / EAS)

1. **`expo-device`** is added for fingerprint metadata — run a **new native build** (EAS), not only OTA, if you rely on device fields on device.
2. Environment: keep **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_ANON_KEY`**; optional **`EXPO_PUBLIC_DRIVER_FF_OVERRIDES`** JSON still overrides DB flags for QA.
3. **Admin users**: `profiles.role = 'admin'` — **Compliance queue** `/(auth)/admin-compliance`: tap a driver to open the **full-screen review** route (`/admin-compliance/review/:id`) with all signed documents, per-doc “reviewed” ticks, then **Confirm approve** / Reject. Refresh reloads the queue; signed URLs last about 1 hour.

---

## 4. Smoke tests (minimum)

| Flow | Check |
|------|--------|
| Email gate | Unconfirmed email cannot pass step 1 / submit |
| ABR | Invalid ABN rejected; active ABN persisted |
| Licence + selfie | Upload licence front/back + `driver_selfie`; submit requires `driver_selfie`; admin compares images manually |
| Inspection | Upload `vehicle_inspection` + expiry when enhanced docs flag on |
| Fraud | “Run fraud scan” on review; duplicates bump risk |
| Submit | `submit-driver-onboarding` returns 400 with clear message if any gate fails |
| Admin | Queue → **modal** → review uploads (signed) → tick each → confirm approve / reject |

---

## 5. Security notes

- **`driver_phone_otp_challenges`** (legacy table from migration `016`; SMS OTP is no longer deployed — safe to leave empty).
- **`compliance_audit_log`**: drivers cannot insert; **admins** can insert for manual notes; **Edge (service role)** writes system events.
- **Never** commit production secrets to the repo.

---

## 6. Optional hardening (later)

- Server-side duplicate **phone** unique partial index (breaking if duplicates exist).
- Richer **liveness** for selfie (not implemented — current check is image similarity only).
- **Hardened OCR** via self-hosted Tesseract worker + `TESSERACT_HTTP_URL` proxy from Edge.

For flag semantics and product mapping, see `docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md`.
