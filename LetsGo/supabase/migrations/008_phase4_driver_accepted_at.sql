-- Phase 4: track when a driver accepted (for cancellation fee window)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz;

COMMENT ON COLUMN public.trips.driver_accepted_at IS 'Set when status becomes driver_accepted; used for rider cancellation fee rules.';
