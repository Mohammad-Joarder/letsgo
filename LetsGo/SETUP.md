# Lets Go — Phase 5 (Stripe) setup

This app uses **Stripe PaymentIntents (manual capture)** for rider fares, **Stripe Connect Express (AU)** for driver payouts, and Supabase Edge Functions for server-side Stripe calls.

## Mobile app

### Dependency

- `@stripe/stripe-react-native` — card entry, `confirmPayment`, Apple Pay merchant ID in `app.config.js`.

### Expo config

`app.config.js` includes the `@stripe/stripe-react-native` plugin and passes through:

| `extra` key | Purpose |
|-------------|---------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (safe in the client). |
| `EXPO_PUBLIC_ALLOW_CASH_BOOKING` | Set to `true` to allow cash demo bookings without a card. |

After changing plugins, run a **development build** (or `expo prebuild`) so native projects pick up Stripe.

### Deep links

- App scheme: `letsgo` (see `app.config.js`).
- Stripe Connect return URL must match what you configure in Supabase (below). The driver onboarding screen shows the exact `Linking.createURL("stripe-connect-return")` value for your environment.

## Supabase Edge Functions — secrets

Set these in **Project Settings → Edge Functions → Secrets** (do **not** prefix custom Stripe secrets with `SUPABASE_`).

**Automate Stripe secrets (Phase 5):** copy `supabase/.env.stripe.example` to `supabase/.env.stripe`, fill in values, ensure the project is linked (`npx supabase link`), then from the `LetsGo` folder run **`npm run secrets:stripe`**. Optional: `npm run secrets:stripe -- --project-ref <ref>`.

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret API key. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe Dashboard → Webhooks. |
| `STRIPE_CONNECT_RETURN_URL` | Must match the app deep link / HTTPS URL Stripe redirects to after Connect onboarding (same value as shown in the driver Stripe screen). |
| `STRIPE_CONNECT_REFRESH_URL` | Optional; defaults to return URL if omitted. |
| `STRIPE_SKIP_VALIDATE` | Optional `true` in dev to relax PaymentIntent checks (never in production). |

Deploy functions touched by Phase 5, including: `create-payment-intent`, `rider-stripe-payment-methods`, `stripe-webhook`, `create-connect-account`, `create-payout`, `charge-rider-tip`, `create-trip`, `complete-trip`.

### Stripe webhook events

Subscribe your endpoint (Supabase function URL for `stripe-webhook`) to at least:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `account.updated`
- `transfer.created` (optional; used for metadata-driven bookkeeping)

## Database

Apply migration `009_phase5_stripe_transfer_id.sql` (and any prior migrations) so `driver_earnings_summary` includes `stripe_transfer_id` where required.

## Test cards (Stripe)

Use [Stripe test cards](https://docs.stripe.com/testing) (e.g. `4242 4242 4242 4242`) with any future expiry and any CVC. For 3DS flows, use the test cards that require authentication.

## Operational notes

- **Rider tip**: After a **card** trip, submitting a rating charges tips ≥ **A$0.50** via `charge-rider-tip` (off-session); if Stripe returns `requires_action`, the app runs `confirmPayment` with the returned `client_secret`.
- **Payouts**: `create-payout` pays out the full pending Connect balance for the driver (partial amounts are rejected by design).
- **Cash demo**: Riders can book with `payment_method: "cash"` when `EXPO_PUBLIC_ALLOW_CASH_BOOKING=true`; tips on cash trips are not sent through Stripe in the app flow.
