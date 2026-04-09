-- Track Stripe Transfer id on weekly earnings rows (webhook + payouts)
ALTER TABLE public.driver_earnings_summary
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

COMMENT ON COLUMN public.driver_earnings_summary.stripe_transfer_id IS 'Stripe Transfer id when earnings moved to Connect (Phase 5).';
