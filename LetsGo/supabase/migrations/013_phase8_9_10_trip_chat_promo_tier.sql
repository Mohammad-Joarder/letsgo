-- Phases 8–10: trip chat, promo columns on trips, driver loyalty tier, scheduled dispatch index,
-- support ticket priority, trip_messages realtime publication

-- -----------------------------------------------------------------------------
-- Driver loyalty tier (Phase 10)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.driver_tier AS ENUM ('standard', 'silver', 'gold', 'platinum');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS tier public.driver_tier NOT NULL DEFAULT 'standard'::public.driver_tier;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS tier_trips_this_period integer NOT NULL DEFAULT 0;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS tier_period_start date;

UPDATE public.drivers
SET tier_period_start = COALESCE(tier_period_start, date_trunc('month', now())::date)
WHERE tier_period_start IS NULL;

-- -----------------------------------------------------------------------------
-- Trips: applied promo snapshot (Phase 10)
-- -----------------------------------------------------------------------------
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS applied_promo_id uuid REFERENCES public.promotions (id) ON DELETE SET NULL;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS promo_discount_amount numeric(12, 2);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS promo_code text;

-- -----------------------------------------------------------------------------
-- Support tickets: priority (Phase 8 filters)
-- -----------------------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- -----------------------------------------------------------------------------
-- trip_messages (Phase 9)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS trip_messages_trip_sent_idx ON public.trip_messages (trip_id, sent_at DESC);

ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_messages_select_participants ON public.trip_messages;
DROP POLICY IF EXISTS trip_messages_insert_participants ON public.trip_messages;
DROP POLICY IF EXISTS trip_messages_update_own_read ON public.trip_messages;

CREATE POLICY trip_messages_select_participants
  ON public.trip_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_messages.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid () OR public.is_admin ())
        AND t.status IN (
          'driver_accepted'::public.trip_status,
          'driver_arrived'::public.trip_status,
          'in_progress'::public.trip_status,
          'completed'::public.trip_status
        )
    )
  );

CREATE POLICY trip_messages_insert_participants
  ON public.trip_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_messages.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid ())
        AND t.status IN (
          'driver_accepted'::public.trip_status,
          'driver_arrived'::public.trip_status,
          'in_progress'::public.trip_status
        )
    )
  );

CREATE POLICY trip_messages_update_own_read
  ON public.trip_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_messages.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid () OR public.is_admin ())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_messages.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid () OR public.is_admin ())
    )
  );

-- Realtime: trip_messages for INSERT subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Scheduled dispatch helper index (Phase 10)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS trips_scheduled_searching_idx
  ON public.trips (scheduled_for, status)
  WHERE scheduled_for IS NOT NULL AND status = 'searching'::public.trip_status;
