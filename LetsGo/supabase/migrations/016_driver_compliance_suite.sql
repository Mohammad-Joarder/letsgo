-- Driver compliance suite: documents, OCR/face/ABN columns, audit, fraud, device, OTP challenges.
-- Enables all app_feature_flags for rollout (toggle off in SQL if needed).

-- -----------------------------------------------------------------------------
-- document_type enum: inspection + selfie
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.document_type ADD VALUE 'vehicle_inspection';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.document_type ADD VALUE 'driver_selfie';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- drivers: compliance fields
-- -----------------------------------------------------------------------------
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS abn text,
  ADD COLUMN IF NOT EXISTS abn_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS abn_entity_name text,
  ADD COLUMN IF NOT EXISTS abn_gst_registered boolean,
  ADD COLUMN IF NOT EXISTS license_ocr jsonb,
  ADD COLUMN IF NOT EXISTS license_ocr_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS selfie_face_similarity numeric(6, 4),
  ADD COLUMN IF NOT EXISTS selfie_face_status text,
  ADD COLUMN IF NOT EXISTS selfie_reverification_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS fraud_risk_level text NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS fraud_risk_notes text,
  ADD COLUMN IF NOT EXISTS primary_device_fingerprint text,
  ADD COLUMN IF NOT EXISTS vehicle_inspection_expiry date;

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_fraud_risk_level_chk;
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_fraud_risk_level_chk
  CHECK (fraud_risk_level IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE INDEX IF NOT EXISTS drivers_abn_idx ON public.drivers (abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS drivers_license_number_idx ON public.drivers (license_number) WHERE license_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Phone OTP challenges (Edge + service role only — no direct client access)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_phone_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_phone_otp_driver_idx ON public.driver_phone_otp_challenges (driver_id, created_at DESC);

ALTER TABLE public.driver_phone_otp_challenges ENABLE ROW LEVEL SECURITY;

-- No policies: block all JWT access; service role bypasses RLS.

-- -----------------------------------------------------------------------------
-- Compliance audit log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers (id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_audit_driver_idx ON public.compliance_audit_log (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_audit_action_idx ON public.compliance_audit_log (action, created_at DESC);

ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_audit_select_admin ON public.compliance_audit_log;
CREATE POLICY compliance_audit_select_admin
  ON public.compliance_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS compliance_audit_select_own_driver ON public.compliance_audit_log;
CREATE POLICY compliance_audit_select_own_driver
  ON public.compliance_audit_log FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Fraud signals (read admin + own driver for transparency)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_fraud_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_fraud_signals_driver_idx ON public.driver_fraud_signals (driver_id, created_at DESC);

ALTER TABLE public.driver_fraud_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_fraud_signals_select_admin ON public.driver_fraud_signals;
CREATE POLICY driver_fraud_signals_select_admin
  ON public.driver_fraud_signals FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS driver_fraud_signals_select_own ON public.driver_fraud_signals;
CREATE POLICY driver_fraud_signals_select_own
  ON public.driver_fraud_signals FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Device registrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_device_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  fingerprint_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_device_fp_idx ON public.driver_device_registrations (fingerprint_hash);
CREATE INDEX IF NOT EXISTS driver_device_driver_idx ON public.driver_device_registrations (driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS driver_fraud_signals_driver_type_uidx
  ON public.driver_fraud_signals (driver_id, signal_type);

ALTER TABLE public.driver_device_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_device_select_admin ON public.driver_device_registrations;
CREATE POLICY driver_device_select_admin
  ON public.driver_device_registrations FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS driver_device_select_own ON public.driver_device_registrations;
CREATE POLICY driver_device_select_own
  ON public.driver_device_registrations FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS driver_device_insert_own ON public.driver_device_registrations;
CREATE POLICY driver_device_insert_own
  ON public.driver_device_registrations FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS driver_device_update_own ON public.driver_device_registrations;
CREATE POLICY driver_device_update_own
  ON public.driver_device_registrations FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Enable all driver compliance feature flags (set to false in production if rolling out gradually)
-- -----------------------------------------------------------------------------
UPDATE public.app_feature_flags SET enabled = true WHERE flag_key IN (
  'driver_phone_otp_verification',
  'driver_email_verification_gate',
  'driver_license_ocr',
  'driver_selfie_face_match',
  'driver_abn_validation',
  'driver_vehicle_docs_enhanced',
  'admin_compliance_dashboard',
  'driver_periodic_selfie_reverification',
  'driver_expiry_monitoring_engine',
  'driver_fraud_detection',
  'driver_device_fingerprinting',
  'driver_audit_logging'
);

GRANT SELECT ON public.compliance_audit_log TO authenticated;
GRANT SELECT ON public.driver_fraud_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_device_registrations TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.compliance_audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.driver_fraud_signals FROM anon, authenticated;

GRANT INSERT ON public.compliance_audit_log TO authenticated;

DROP POLICY IF EXISTS compliance_audit_insert_admin ON public.compliance_audit_log;
CREATE POLICY compliance_audit_insert_admin
  ON public.compliance_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.driver_phone_otp_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.driver_phone_otp_challenges TO service_role;
