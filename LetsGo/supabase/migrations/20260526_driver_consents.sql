-- Driver background-check consent and drawn signature record.
-- Only adds the driver_consents table — all other tables already exist.

CREATE TABLE IF NOT EXISTS public.driver_consents (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers (id) ON DELETE CASCADE,
  consented_at timestamptz NOT NULL,
  signature_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS driver_consents_set_updated_at ON public.driver_consents;
CREATE TRIGGER driver_consents_set_updated_at
  BEFORE UPDATE ON public.driver_consents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.driver_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_consents_select_own_or_admin ON public.driver_consents;
CREATE POLICY driver_consents_select_own_or_admin
  ON public.driver_consents FOR SELECT
  USING (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS driver_consents_insert_own ON public.driver_consents;
CREATE POLICY driver_consents_insert_own
  ON public.driver_consents FOR INSERT
  WITH CHECK (driver_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS driver_consents_update_own_or_admin ON public.driver_consents;
CREATE POLICY driver_consents_update_own_or_admin
  ON public.driver_consents FOR UPDATE
  USING (driver_id = auth.uid() OR public.is_admin())
  WITH CHECK (driver_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.driver_consents TO authenticated;
