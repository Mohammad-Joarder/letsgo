-- Default fare rows (AUD) — safe to re-run
INSERT INTO public.fare_config (
  ride_type,
  base_fare,
  per_km_rate,
  per_min_rate,
  minimum_fare,
  platform_fee_percent,
  cancellation_fee,
  is_active
)
VALUES
  ('economy', 3.50, 1.20, 0.35, 8.00, 0.15, 5.00, true),
  ('comfort', 5.00, 1.55, 0.45, 12.00, 0.15, 6.00, true),
  ('premium', 8.00, 2.10, 0.55, 18.00, 0.18, 8.00, true),
  ('xl', 6.50, 1.85, 0.50, 14.00, 0.15, 7.00, true)
ON CONFLICT (ride_type) DO NOTHING;

-- PostGIS helper for edge function (SECURITY DEFINER — reads driver locations; still only returns public fields)
CREATE OR REPLACE FUNCTION public.nearby_drivers_for_ride (
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_ride_type public.ride_type
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
  INNER JOIN public.vehicles v ON v.driver_id = d.id
    AND v.is_active = true
    AND v.is_approved = true
    AND v.ride_type = p_ride_type
  WHERE d.is_online = true
    AND d.current_status = 'online'::public.driver_status
    AND d.approval_status = 'approved'::public.driver_approval_status
    AND d.current_location IS NOT NULL
    AND ST_DWithin(
      d.current_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    );
$$;

GRANT EXECUTE ON FUNCTION public.nearby_drivers_for_ride (double precision, double precision, double precision, public.ride_type) TO authenticated;
