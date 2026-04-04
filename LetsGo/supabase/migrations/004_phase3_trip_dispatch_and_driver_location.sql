-- Phase 3: sequential driver offers + driver location RPC (auth.uid())

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS offer_driver_id uuid REFERENCES public.drivers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_candidate_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS offer_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS trips_offer_driver_idx ON public.trips (offer_driver_id)
  WHERE offer_driver_id IS NOT NULL;

-- Drivers can read trips currently offered to them (for offer modal + details)
CREATE POLICY trips_select_if_offered_driver
  ON public.trips FOR SELECT
  TO authenticated
  USING (offer_driver_id = auth.uid ());

COMMENT ON COLUMN public.trips.offer_candidate_ids IS 'Ordered driver ids for sequential offers (Phase 3)';
COMMENT ON COLUMN public.trips.offer_index IS 'Index into offer_candidate_ids for current offer';

-- Called with end-user JWT from Edge or app; updates own driver row + optional trip trace
CREATE OR REPLACE FUNCTION public.driver_update_location (p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.drivers
  SET
    current_location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    current_location_updated_at = now()
  WHERE id = auth.uid ();

  SELECT t.id INTO tid
  FROM public.trips t
  WHERE t.driver_id = auth.uid ()
    AND t.status IN (
      'driver_accepted'::public.trip_status,
      'driver_arrived'::public.trip_status,
      'in_progress'::public.trip_status
    )
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF tid IS NOT NULL THEN
    INSERT INTO public.trip_locations (trip_id, lat, lng)
    VALUES (tid, p_lat, p_lng);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_update_location (double precision, double precision) TO authenticated;
