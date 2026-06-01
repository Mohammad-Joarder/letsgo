-- Remote feature flags (toggle without app store release) + driver verification columns.
-- Safe defaults: all flags disabled; new columns nullable.

-- -----------------------------------------------------------------------------
-- app_feature_flags: one row per flag key; readable by any client, writable by admins
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  flag_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS app_feature_flags_set_updated_at ON public.app_feature_flags;
CREATE TRIGGER app_feature_flags_set_updated_at
  BEFORE UPDATE ON public.app_feature_flags
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_feature_flags_select_all ON public.app_feature_flags;
CREATE POLICY app_feature_flags_select_all
  ON public.app_feature_flags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS app_feature_flags_update_admin ON public.app_feature_flags;
CREATE POLICY app_feature_flags_update_admin
  ON public.app_feature_flags FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS app_feature_flags_insert_admin ON public.app_feature_flags;
CREATE POLICY app_feature_flags_insert_admin
  ON public.app_feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Seed keys (idempotent). Keep flag_key values in sync with lib/driverRegistrationFeatureFlags.ts
INSERT INTO public.app_feature_flags (flag_key, enabled, description) VALUES
  ('driver_phone_otp_verification', false, 'SMS phone ownership verification before onboarding completes.'),
  ('driver_email_verification_gate', false, 'Require confirmed email (Supabase auth) before onboarding completes.'),
  ('driver_license_ocr', false, 'Tesseract OCR on licence images + admin review of extracted fields.'),
  ('driver_selfie_face_match', false, 'Selfie vs licence photo face match + manual review queue.'),
  ('driver_abn_validation', false, 'ABR API validation for Australian Business Number.'),
  ('driver_vehicle_docs_enhanced', false, 'Extra vehicle compliance docs, OCR expiry extraction, admin review states.'),
  ('admin_compliance_dashboard', false, 'Admin queue, checklist, fraud/OCR/selfie review tooling.'),
  ('driver_periodic_selfie_reverification', false, 'Periodic / suspicious-login selfie re-check.'),
  ('driver_expiry_monitoring_engine', false, 'Scheduled reminders and suspension for expired documents.'),
  ('driver_fraud_detection', false, 'Duplicate signals + lightweight risk scoring.'),
  ('driver_device_fingerprinting', false, 'Device fingerprint at onboarding + admin visibility.'),
  ('driver_audit_logging', false, 'Structured audit trail for verification and admin actions.')
ON CONFLICT (flag_key) DO NOTHING;

GRANT SELECT ON public.app_feature_flags TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_feature_flags TO authenticated;

-- -----------------------------------------------------------------------------
-- profiles.phone_verified_at — set only by service role / admin (trigger below)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.profiles_protect_phone_verified_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at
     AND NOT public.is_admin() THEN
    -- Service role / Postgres often has auth.uid() NULL; allow those updates.
    IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id THEN
      RAISE EXCEPTION 'phone_verified_at cannot be set from the client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_phone_verified_at_trg ON public.profiles;
CREATE TRIGGER profiles_protect_phone_verified_at_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.profiles_protect_phone_verified_at();
