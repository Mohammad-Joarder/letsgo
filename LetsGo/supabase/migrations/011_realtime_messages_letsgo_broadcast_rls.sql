-- When Supabase "Realtime Authorization" is enabled, clients must be allowed to SELECT
-- on realtime.messages for a topic or they never join the channel and miss broadcasts.
-- We only add policies if RLS is already on for realtime.messages (we do not enable it here).
DO $body$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages missing, skipping letsgo broadcast policies';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime'
      AND c.relname = 'messages'
      AND c.relrowsecurity
  ) THEN
    RAISE NOTICE 'realtime.messages RLS is off, skipping (default public Realtime is unchanged)';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'letsgo_rt_broadcast_read'
  ) THEN
    CREATE POLICY "letsgo_rt_broadcast_read"
      ON "realtime"."messages"
      FOR SELECT
      TO authenticated
      USING (
        (SELECT realtime.topic()) LIKE ('%' || 'driver_trip_offers:' || (auth.uid())::text)
        OR (
          (regexp_match(
            btrim((SELECT realtime.topic())), 'trip_updates:([0-9a-fA-F-]{36})'
          ))[1] IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.trips t
            WHERE
              t.id = (regexp_match(
                btrim((SELECT realtime.topic())), 'trip_updates:([0-9a-fA-F-]{36})'
              ))[1]::uuid
              AND (
                t.rider_id = auth.uid()
                OR t.driver_id = auth.uid()
                OR t.offer_driver_id = auth.uid()
              )
          )
        )
      );
  END IF;
END
$body$;
