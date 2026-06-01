# Lets Go — Phase 5 (Stripe) setup

This app uses **Stripe PaymentIntents (manual capture)** for rider fares, **Stripe Connect Express (AU)** for driver payouts, and Supabase Edge Functions for server-side Stripe calls.

## Mobile app

### Dependency

- `@stripe/stripe-react-native` — card entry, `confirmPayment`, Apple Pay merchant ID in `app.config.js` (`merchant.com.letsgoau.app`).

### Bundle identifiers

| Platform | ID |
|----------|-----|
| iOS | `com.letsgoau.app` |
| Android | `com.letsgoau.app` |

### App icon & splash (EAS / stores)

Brand source: `assets/images/brand/logo-full.png`.

Generated on `npm install` (postinstall) and when you run `npm run generate:icons` locally. **Do not** set `prebuildCommand` in `eas.json` for this — EAS passes `--platform` to that hook and breaks `npm run`.

| File | Use |
|------|-----|
| `assets/icon.png` | iOS/Android app icon (1024×1024) |
| `assets/adaptive-icon.png` | Android adaptive foreground |
| `assets/splash-icon.png` | Native splash (via `expo-splash-screen`) |
| `assets/notification-icon.png` | Android push notification glyph |
| `assets/store/icon-1024.png` | App Store Connect listing (upload if prompted) |
| `assets/store/icon-512.png` | Play Console listing (upload if prompted) |

Regenerate after logo changes: `npm run generate:icons`

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

Apply **`015_app_feature_flags_and_driver_verification.sql`** for remote driver feature flags (`app_feature_flags`) and optional `profiles.phone_verified_at` (see `docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md`).

Apply **`016_driver_compliance_suite.sql`** for the full compliance schema (ABN, OCR, selfie scores, fraud, audit, device registrations, inspection document enum, **all flags enabled** — turn selected flags off in SQL after apply if needed). See `docs/COMPLIANCE_RELEASE_CHECKLIST.md`.

## Test cards (Stripe)

Use [Stripe test cards](https://docs.stripe.com/testing) (e.g. `4242 4242 4242 4242`) with any future expiry and any CVC. For 3DS flows, use the test cards that require authentication.

## Twilio (optional)

SMS OTP for drivers has been **removed** from the app. If you add Twilio SMS elsewhere, see **`docs/TWILIO_SMS_AU.md`** for **21408** (geo permissions) and **21608** (trial destinations).

## Operational notes

- **Rider tip**: After a **card** trip, submitting a rating charges tips ≥ **A$0.50** via `charge-rider-tip` (off-session); if Stripe returns `requires_action`, the app runs `confirmPayment` with the returned `client_secret`.
- **Payouts**: `create-payout` pays out the full pending Connect balance for the driver (partial amounts are rejected by design).
- **Cash demo**: Riders can book with `payment_method: "cash"` when `EXPO_PUBLIC_ALLOW_CASH_BOOKING=true`; tips on cash trips are not sent through Stripe in the app flow.

## Email templates (Supabase Auth)

In the Supabase Dashboard go to **Authentication → Email Templates**. Configure copy for:

- **Confirm signup** — welcome tone; link must match your app’s deep link / site URL.
- **Reset password** — short instructions; same redirect domain as production.
- **Magic link** — if used.

For **driver approved / rejected** and **weekly earnings**, the app uses custom Edge logic and `notifications` / push; mirror any critical legal text in the Auth email “Invite user” template if you email drivers from Supabase manually. For automated driver lifecycle emails, use Auth hooks (Database Webhooks on `drivers.approval_status`) or a transactional provider and document the chosen URL and secrets here.

## Scheduled rides (cron)

1. Set Edge secret **`DISPATCH_SCHEDULED_CRON_SECRET`** (long random string).
2. Schedule HTTP calls to **`dispatch-scheduled-trips`** every minute with header **`x-cron-secret: <same value>`** (Supabase scheduled functions, GitHub Actions, or external cron).
3. Apply migration **`013_phase8_9_10_trip_chat_promo_tier.sql`** (trip chat, promo columns, driver tier, support priority, realtime for `trip_messages`).

## Push notifications (Expo)

- Set **`EAS_PROJECT_ID`** / `extra.eas.projectId` so `expo-notifications` can mint push tokens.
- Edge functions log in-app rows via **`push_to_user`** (`_shared/push_to_user.ts`) and send Expo pushes when a token exists.
