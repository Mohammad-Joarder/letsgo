-- Phase 7 — Driver onboarding: private storage for driver documents + approval_status guard

-- -----------------------------------------------------------------------------
-- Storage bucket: driver-documents (object key: {driver_id}/{document_type}/{uuid}.ext)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

DROP POLICY IF EXISTS driver_documents_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS driver_documents_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS driver_documents_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS driver_documents_storage_delete_own ON storage.objects;

CREATE POLICY driver_documents_storage_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY driver_documents_storage_select_own
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY driver_documents_storage_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY driver_documents_storage_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- One row per (driver_id, document_type) for simpler upserts from the app
-- -----------------------------------------------------------------------------
DELETE FROM public.driver_documents a
  USING public.driver_documents b
 WHERE a.id > b.id
   AND a.driver_id = b.driver_id
   AND a.document_type = b.document_type;

CREATE UNIQUE INDEX IF NOT EXISTS driver_documents_driver_type_uidx
  ON public.driver_documents (driver_id, document_type);

-- -----------------------------------------------------------------------------
-- Drivers cannot change their own approval_status (admins + service role OK)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drivers_block_self_approval_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'approval_status cannot be changed from the driver app';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drivers_block_self_approval_status_change_trg ON public.drivers;
CREATE TRIGGER drivers_block_self_approval_status_change_trg
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE PROCEDURE public.drivers_block_self_approval_status_change();
