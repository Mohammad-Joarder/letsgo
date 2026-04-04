-- Dispatch: include approved drivers with a matching approved vehicle, OR economy trips when
-- the driver has no vehicle row yet (onboarding). Fixes empty nearby list when vehicles were never inserted.

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
  WHERE d.is_online = true
    AND d.current_status = 'online'::public.driver_status
    AND d.approval_status = 'approved'::public.driver_approval_status
    AND d.current_location IS NOT NULL
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

GRANT EXECUTE ON FUNCTION public.nearby_drivers_for_ride (double precision, double precision, double precision, public.ride_type) TO authenticated;
