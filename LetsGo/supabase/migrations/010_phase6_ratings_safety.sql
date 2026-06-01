-- Phase 6 — Ratings, safety (SOS), driver min rider rating, rider ID storage prep

-- -----------------------------------------------------------------------------
-- trips: SOS fields
-- -----------------------------------------------------------------------------
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS sos_triggered boolean NOT NULL DEFAULT false;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS sos_at timestamptz;

-- -----------------------------------------------------------------------------
-- drivers: minimum rider rating filter (nullable = no minimum)
-- -----------------------------------------------------------------------------
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS min_rider_rating numeric(3, 2);

ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_min_rider_rating_range;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_min_rider_rating_range CHECK (
    min_rider_rating IS NULL
    OR (min_rider_rating >= 1 AND min_rider_rating <= 5)
  );

-- -----------------------------------------------------------------------------
-- profiles: Expo push token (used by SOS → admin alert; full flow in Phase 9)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text;

-- -----------------------------------------------------------------------------
-- One rating per trip per direction (from_user)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ratings_trip_from_user_unique
  ON public.ratings (trip_id, from_user_id);

-- -----------------------------------------------------------------------------
-- Nearby drivers RPC: optional rider rating vs driver.min_rider_rating
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.nearby_drivers_for_ride (
  double precision,
  double precision,
  double precision,
  public.ride_type
);

CREATE OR REPLACE FUNCTION public.nearby_drivers_for_ride (
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_ride_type public.ride_type,
  p_rider_rating double precision
)
RETURNS TABLE (
  driver_id uuid,
  distance_m double precision,
  current_lat double precision,
  current_lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id AS driver_id,
    ST_Distance(
      d.current_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::double precision AS distance_m,
    ST_Y(d.current_location::geometry)::double precision AS current_lat,
    ST_X(d.current_location::geometry)::double precision AS current_lng
  FROM public.drivers d
  WHERE d.is_online = true
    AND d.current_status = 'online'::public.driver_status
    AND d.approval_status = 'approved'::public.driver_approval_status
    AND d.current_location IS NOT NULL
    AND (d.min_rider_rating IS NULL OR p_rider_rating >= d.min_rider_rating)
    AND ST_DWithin(
      d.current_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.vehicles v
        WHERE v.driver_id = d.id
          AND v.is_active = true
          AND v.is_approved = true
          AND v.ride_type = p_ride_type
      )
      OR (
        p_ride_type = 'economy'::public.ride_type
        AND NOT EXISTS (SELECT 1 FROM public.vehicles v0 WHERE v0.driver_id = d.id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.nearby_drivers_for_ride (
  double precision,
  double precision,
  double precision,
  public.ride_type,
  double precision
) TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage: rider government ID uploads (private bucket)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('rider-verification', 'rider-verification', false)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

DROP POLICY IF EXISTS rider_verification_insert_own ON storage.objects;
DROP POLICY IF EXISTS rider_verification_select_own ON storage.objects;
DROP POLICY IF EXISTS rider_verification_update_own ON storage.objects;
DROP POLICY IF EXISTS rider_verification_delete_own ON storage.objects;

CREATE POLICY rider_verification_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY rider_verification_select_own
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY rider_verification_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'rider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY rider_verification_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
