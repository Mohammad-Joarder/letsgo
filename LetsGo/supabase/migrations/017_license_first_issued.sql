-- First issue date of the driver's licence (as shown on the card). Used to enforce
-- minimum time holding a valid licence before driving on the platform.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS license_first_issued date;

COMMENT ON COLUMN public.drivers.license_first_issued IS 'Date licence was first issued (Australian licence: typically 4a). Used for minimum held period (e.g. 6 months).';
