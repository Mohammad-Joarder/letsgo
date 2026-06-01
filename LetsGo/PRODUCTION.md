# Production checklist (Supabase + Stripe + Lets Go)

- Switch mobile env to **live** `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` and Edge secret `STRIPE_SECRET_KEY` (live).
- Point Stripe **webhooks** at the deployed `stripe-webhook` URL; verify signing secret matches `STRIPE_WEBHOOK_SECRET`.
- Enable **Supabase email confirmations** and tighten Auth settings.
- Apply all SQL migrations (including `013_phase8_9_10_trip_chat_promo_tier.sql`).
- Configure **`DISPATCH_SCHEDULED_CRON_SECRET`** and a scheduler hitting `dispatch-scheduled-trips` with `x-cron-secret`.
- Review **RLS** for `trip_messages`, `notifications`, and admin-only paths.
- Enable **PITR** and backups on the Supabase project.
