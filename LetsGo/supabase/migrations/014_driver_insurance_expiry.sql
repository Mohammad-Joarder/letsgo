-- Driver insurance policy expiry (onboarding step 4)
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS insurance_expiry date;
