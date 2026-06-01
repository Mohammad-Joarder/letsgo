# Lets Go — Product overview & functional specification (knowledge base)

**Version:** 1.1 (synced with repository implementation, 2026-05-26)  
**Audience:** Product, engineering, compliance, and AI agents working in this codebase  
**Scope:** Mobile app (`LetsGo` / Expo) + Supabase Edge Functions + documented operational dependencies

---

## 1. About this document

### 1.1 “Master prompt” and sources of truth

There is **no checked-in file** in this repository named “master prompt.” In Cursor, the assistant starts from **system and developer instructions** (not stored in git) plus whatever files you open or attach.

This markdown file is the **in-repo knowledge base**: it synthesizes:

| Source | Role |
|--------|------|
| `SETUP.md` | Stripe, Supabase secrets, migrations, push, scheduled rides, env keys |
| `PRODUCTION.md` | Go-live checklist |
| `APPSTORE.md` | iOS encryption compliance, store listing notes |
| `docs/COMPLIANCE_RELEASE_CHECKLIST.md` | Driver compliance rollout |
| `docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md` | Feature flags vs implementation |
| Application code under `app/`, `lib/`, `context/`, `components/`, `supabase/functions/` | Actual behaviour and APIs |

When this doc disagrees with code, **trust the code** and update this file.

---

## 2. Executive product overview

**Lets Go** is a **dual-sided mobility product** (riders and drivers) positioned for **Australia**, with branding and copy referencing nationwide service and **AUD** pricing. The client is an **Expo (React Native)** app using **expo-router** file-based routing, **Supabase** for auth/data/realtime, and **Stripe** for rider payments (PaymentIntents, manual capture) and **Stripe Connect Express (AU)** for driver payouts.

**Taglines (in-app):**

- `lib/constants.ts`: in-app `APP_TAGLINE` — “Get there, your way.”
- Welcome / marketing: `BRAND_TAGLINE` — “Ride Smart. Pay Less.”

**Bundle / scheme:**

- iOS & Android package: `com.letsgoau.app` (`app.config.js`)
- **Store-facing version** in `app.config.js`: `1.0.3` (iOS `buildNumber` / Android `versionCode` increment per release)
- Deep link scheme: `letsgo`

**Ride types:** Economy, Comfort, Premium, XL (`lib/constants.ts` — seat counts and descriptions).

---

## 3. User roles and access model

| Role | `profiles.role` | Primary experience |
|------|------------------|----------------------|
| **Rider** | `rider` | Book trips, pay (card / optional cash demo), live trip UI, history, notifications, account (wallet, ID verify, theme) |
| **Driver** | `driver` | Onboarding / status hub → (if approved) Stripe Connect → tabs (home, earnings, alerts, account) → trip flows; rejected / suspended have dedicated screens |
| **Admin** | `admin` | Admin-only routes (compliance queue, etc.) |

**Routing guards (high level):**

- `app/(auth)/_layout.tsx` — After session + profile load: sends riders to rider home, drivers to driver area (approved → tabs home; not approved → onboarding status), admins to admin screens.
- `app/(rider)/_layout.tsx` — Requires session + `rider` role.
- `app/(driver)/_layout.tsx` — Requires session + `driver` role; enforces **approval status** (rejected → `application-rejected`, suspended → `suspended-notice`, pending/under_review → onboarding hub / allowed roots) and **Stripe Connect onboarding** for approved drivers.

**Driver approval states** (`lib/types.ts`): `pending` | `under_review` | `approved` | `rejected` | `suspended`.

---

## 4. Technical architecture

### 4.1 Client application

- **Framework (from `package.json`):** Expo `~54.0.33`, React `19.1.0`, React Native `0.81.5`, **expo-router** `~6.0.23`
- **Styling:** NativeWind (Tailwind)
- **Maps:** `react-native-maps` (Google Maps keys via `app.config.js`)
- **Payments:** `@stripe/stripe-react-native` inside `StripeProvider` (`app/_layout.tsx`); Apple Pay merchant id from config (`merchant.com.letsgoau.app` default)
- **Charts (driver earnings):** `react-native-gifted-charts` (weekly net earnings line chart)
- **State:** React Context — `AuthContext`, `FeatureFlagsContext`, `ThemeContext`
- **Sheets / modals:** `@gorhom/bottom-sheet`, custom modal chrome

### 4.2 Backend

- **Supabase:** Auth (email/password, magic flows as configured), Postgres, Storage (documents), Realtime (e.g. trip updates / chat per migrations)
- **Edge Functions (Deno):** Business logic that must not run on the client (Stripe, dispatch, compliance, payouts, etc.) — see **§8**

### 4.3 Integrations (non-exhaustive)

- **Stripe:** PaymentIntents, Connect Express, webhooks (`stripe-webhook`)
- **Google Maps / Directions:** Geocoding, map display, route polylines (client uses API key from env)
- **Expo Push:** Token registration; Edge uses shared `push_to_user` helper
- **Twilio / ABR / OCR.space:** Optional or compliance-phase services (see `SETUP.md`, `COMPLIANCE_RELEASE_CHECKLIST.md`)

---

## 5. Trip lifecycle (functional spec)

The app and Edge functions implement a **state machine** around the `trips` table. Representative statuses referenced in code:

| Status | Meaning (behavioural) |
|--------|------------------------|
| `searching` | Rider requested a driver; dispatch offers drivers; rider may see `searching` screen |
| `driver_accepted` | A driver accepted the offer; rider moves toward pickup flow |
| `driver_arrived` | Driver at pickup; PIN verification may be required (`trip-active.tsx`) |
| `in_progress` | Trip underway; live map experience |
| `completed` | Finished; ratings / tips may apply |
| `cancelled` | Cancelled per rules (`rider-cancel-trip`) |
| `no_driver_found` | Terminal search failure |

**Key flows:**

1. **Estimate** — `get-fare-estimate` Edge; rider home loads options and route.
2. **Book** — Rider authorizes **card** via Stripe (`create-payment-intent`) unless cash demo or skip flags; `create-trip` requires `stripe_payment_intent_id` for card in production path.
3. **Dispatch** — `create-trip` sets trip to `searching` and uses shared dispatch helper to notify drivers (`dispatch_searching_trip.ts`).
4. **Offer / accept** — Drivers receive offers; `assign-driver` validates `offer_driver_id` and `searching` state for accept/reject.
5. **Progression** — Client UIs: `searching`, `trip-awaiting-pickup`, `trip-live`, `trip-complete` (rider); driver `pickup-navigation`, `trip-active`, `trip-summary`.
6. **Complete** — `complete-trip` (driver): validates `in_progress`, computes final fare (override vs estimate), platform fee from `fare_config`, Stripe capture/transfer behaviour, tier updates, notifications/realtime as implemented.
7. **Post-trip** — `submit-rating` expects `completed`; **tips** on card trips via `charge-rider-tip` (see `SETUP.md` — minimum tip threshold and 3DS path).

**Scheduled trips:**

- `scheduled_for` on create payload; cron secret `DISPATCH_SCHEDULED_CRON_SECRET` + `dispatch-scheduled-trips` (see `SETUP.md`).

### 5.1 Client route map (implemented)

Authoritative file paths live under `app/`. This table is the **inventory of shipped navigation targets** (excluding dev-only internals).

| Area | Routes / screens |
|------|-------------------|
| **Root** | `app/+not-found.tsx` — unknown deep links; `app/verify-otp.tsx` — forwards `letsgo://verify-otp?email=…` to `/(auth)/verify-otp` (see `lib/auth.ts`) |
| **Auth group** `(auth)` | `index` (welcome / entry), `sign-in`, `sign-up`, `forgot-password`, `verify-otp`, `role-select`, `admin-only`, `admin-compliance` (includes **modal** driver approval review), `driver-review-pending` (legacy **Redirect** to `/(driver)/onboarding-status`) |
| **Rider** `(rider)` | **Tabs:** `home`, `my-rides`, `notifications`, `account`. **Stack:** `searching`, `trip-awaiting-pickup`, `trip-live`, `trip-complete`, `payment-methods`, `help` |
| **Driver** `(driver)` | **Gate / status:** `onboarding-status`, `application-rejected` (`approval_status=rejected`), `suspended-notice` (`suspended`), `stripe-onboarding` (approved + Connect not ready). **Onboarding wizard:** `onboarding/index` + `step1-personal` … `step9-submitted`, `onboarding/verification-hub`. **Operations:** `(tabs)` (`home`, `earnings`, `notifications`, `account`), `pickup-navigation`, `trip-active`, `trip-summary`, `help`, `account/vehicles` |

**Driver layout guards** (`app/(driver)/_layout.tsx`): non-`approved` drivers are kept on onboarding / status / help / `account/*` roots per `unapprovedDriverAllowedRoot`; rejected and suspended get dedicated screens; approved drivers must complete Stripe Connect (unless gate temporarily suppressed in auth state).

---

## 6. Functional areas (detailed)

### 6.1 Authentication & account

- **Screens:** `/(auth)/` (welcome), `sign-in`, `sign-up`, `forgot-password`, `verify-otp`, `role-select`; admins: `admin-only`, `admin-compliance` (queue + **modal** per-driver approval); legacy `driver-review-pending` redirects into driver onboarding status.
- **Email / password:** Primary UX — `signInWithEmail`, `signUpWithEmail`, `verifyEmailOtp` (`lib/auth.ts`). Sign-up confirmation and OTP entry use `/(auth)/verify-otp`; production builds prefer scheme URL `letsgo://verify-otp?email=…` (configurable via `EXPO_PUBLIC_AUTH_EMAIL_REDIRECT`).
- **Password reset:** `forgot-password` calls `requestPasswordReset` → Supabase email with `redirectTo: letsgo://reset-password`. **There is currently no `reset-password` route file** under `app/` matching that scheme — treat in-app completion of recovery as a **known gap** (§11); Supabase may still allow web recovery if Site URL is web.
- **Social login:** `package.json` includes `@react-native-google-signin/google-signin` and `expo-apple-authentication`, but **sign-in / sign-up screens do not invoke OAuth**, and `app.config.js` does not register those plugins. Social login is **not a production-shipped path** until wired in UI + config.
- **Profile:** Loaded in `AuthContext` from `profiles`; drivers also load `drivers.approval_status`, `stripe_connect_onboarded`
- **Push:** Deferred registration after session (`registerExpoPushToken`)

### 6.2 Rider — booking and payments

- **Home map flow** (`app/(rider)/(tabs)/home.tsx`): pickup/dropoff resolution, route polyline, fare options, surge display, schedule picker, promo resolution, payment block (card vs cash demo), `createTrip`.
- **Payment methods:** Stack screen `payment-methods`; Edge `rider-stripe-payment-methods` (list/attach/detach/default).
- **Promos:** `validate-promo` Edge; create-trip payload supports promo metadata (`riderEdge.ts`).
- **Resume active trip:** On focus, queries latest non-terminal trip and navigates to searching / awaiting pickup / live.
- **Account** (`(rider)/(tabs)/account.tsx`): profile summary, **star rating + histogram** from `ratings`, **`riders.wallet_balance`**, optional **ID verification** request via Edge `request-rider-id-verification`, color theme picker, sign out.
- **Help:** `/(rider)/help` stack screen.

### 6.3 Rider — in-trip and safety

- **Trip chat:** `TripChatModal` on awaiting-pickup, live trip, and driver pickup/active UIs; migration note `013` in `SETUP.md` (realtime `trip_messages`).
- **Pickup PIN:** Trips carry `pickup_pin` from `create-trip`; rider sees PIN on **awaiting pickup** / related UIs; driver must enter PIN in **`trip-active`** while status is `driver_arrived` before starting `in_progress`.
- **Share trip:** `lib/shareTrip.ts` — native share sheet + clipboard copy with public tracking URL pattern `https://letsgo.app/track/{tripId}` (used from rider live / awaiting-pickup flows).
- **SOS:** Edge `trip-sos` (status-gated server behaviour).
- **Cancel:** `rider-cancel-trip` with state-specific logic.
- **Post-trip ratings:** `RatingFormBlock` / `RatingModal` patterns on `trip-complete` (rider ↔ driver modes with optional tag chips per `components/shared/RatingModal.tsx`).

### 6.4 Driver — onboarding & compliance

**Wizard:** `app/(driver)/onboarding/*` — numbered steps `step1-personal` … `step9-submitted` (`lib/driverOnboardingSteps.ts`) plus **`verification-hub`** for email confirmation when that gate is on.

**Server-side submission gate:** `submit-driver-onboarding` enforces document presence (including `driver_selfie`), bank formatting, minimum licence/insurance horizons, and **feature-flagged** requirements (email confirmation, ABN, vehicle inspection, fraud scan, device registration, audit).

**Compliance edges (representative):**

- `abr-lookup-abn`
- `register-driver-device`
- `evaluate-driver-fraud`
- `compliance-expiry-scan` (cron)
- `admin-compliance-drivers` / `admin-compliance-driver-detail` / `admin-compliance-action`

**In-app admin:** `/(auth)/admin-compliance` — queue list; tapping a driver opens a **full-screen modal** with signed documents + checklist for `profiles.role = 'admin'`.

### 6.5 Driver — operations

- **Tabs:** Home (online/offers), **earnings**, notifications, account (`app/(driver)/(tabs)/`).
- **Home:** Active-trip resume, `DriverTripOffersHost` for `searching` + `offer_driver_id`, online/offline toggling.
- **Earnings** (`earnings.tsx`): reads `driver_earnings_summary` (weekly net, payout status), recent **completed** trips list, **line chart** (gifted-charts), **Request payout** via `create-payout` Edge (`lib/driverEdge.ts`).
- **Trip offers:** `DriverTripOffersHost` listens for `searching` trips where `offer_driver_id` matches user
- **Location:** `update-driver-location` Edge (background location described in iOS plist)
- **Stripe Connect:** `stripe-onboarding`, sync helpers, return URL flow documented in `SETUP.md`
- **Payouts:** `create-payout` — pays **full** pending Connect balance (partial rejected by design per `SETUP.md`)
- **Account** (`(driver)/(tabs)/account.tsx`): approval badge, rating/trips, **active vehicle** summary, **document verification** list, masked bank + Stripe readiness, **recent reviews**, **navigation app preference** (Google / Waze / Apple Maps, `AsyncStorage`), **`min_rider_rating`** display, **Record my ride** toggle (`useDriverTripRecording` — aligns with microphone plist copy), link to **manage vehicles** (`account/vehicles`), color theme, help/sign out.
- **Vehicles:** `account/vehicles.tsx` — vehicle listing / management for approved drivers.
- **Help:** `/(driver)/help`.
- **Trip UIs:** `pickup-navigation`, `trip-active` (PIN gate, chat modal, optional dev end-trip), `trip-summary` (post-trip rating block).

### 6.6 Admin & support tooling

- **Routes:** `admin-only`, `admin-compliance` (list + **modal** driver approval).
- **Edges:** `admin-compliance-drivers`, `admin-compliance-driver-detail`, `admin-compliance-action`, `admin-refund-trip`

### 6.7 Notifications

- DB-backed notifications + Expo push (`push_to_user.ts` pattern)
- Unread counts in UI hooks (e.g. rider/driver tabs)

### 6.8 Theming & UX

- **ThemeContext** + `useTheme` — light/dark and stored preference (`themeStorage.ts`)
- **Color theme picker** component for user-selectable palettes (`LetsGo_Color_Themes.md` in repo root for marketing/theme doc)

### 6.9 Feature flags

- **Table:** `app_feature_flags` (keys in `lib/driverRegistrationFeatureFlags.ts`)
- **Client merge:** Remote flags + optional `EXPO_PUBLIC_DRIVER_FF_OVERRIDES` JSON (`FeatureFlagsContext.tsx`)
- **Semantics:** Documented in `docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md`

---

## 7. Edge function catalog

| Function | Purpose (summary) |
|----------|-------------------|
| `create-trip` | Authorised rider creates trip; Stripe PI validation; dispatch searching |
| `assign-driver` | Driver accept/reject offer; vehicle checks; state transitions |
| `complete-trip` | Driver completes in_progress trip; fare, fees, Stripe capture/transfer, tier |
| `rider-cancel-trip` | Rider-side cancellation rules |
| `get-fare-estimate` | Pricing estimate for route / ride type |
| `search-nearby-drivers` | Discovery / map markers |
| `update-driver-location` | Live driver position updates |
| `create-payment-intent` | Rider authorisation amounts |
| `rider-stripe-payment-methods` | Saved cards CRUD |
| `stripe-webhook` | Stripe event sync |
| `create-connect-account` / `create-connect-account-return` / `sync-driver-stripe-connect` | Connect onboarding |
| `create-payout` | Driver balance payout |
| `charge-rider-tip` | Post-trip tip charging |
| `submit-rating` | Ratings after completed |
| `validate-promo` | Promo validation |
| `dispatch-scheduled-trips` | Cron: promote scheduled trips |
| `send-push-notification` | Push helper entrypoint (if used standalone) |
| `submit-driver-onboarding` | Gate + submit driver application |
| `abr-lookup-abn` | Australian Business Register |
| `register-driver-device` | Device fingerprint registration |
| `evaluate-driver-fraud` | Fraud scoring |
| `compliance-expiry-scan` | Expiry notifications / compliance batch |
| `admin-compliance-drivers` / `admin-compliance-driver-detail` / `admin-compliance-action` | Admin queue + per-driver signed doc bundle + actions |
| `admin-refund-trip` | Support refunds |
| `request-rider-id-verification` | Rider identity verification flow (server entry) |
| `trip-sos` | SOS handling |

*(Deploy list and secrets: `SETUP.md`, `COMPLIANCE_RELEASE_CHECKLIST.md`, `PRODUCTION.md`.)*

---

## 8. Data model (code-level summary)

Authoritative schema lives in **SQL migrations** under `supabase/migrations` (referenced by `SETUP.md`). The TypeScript layer expects at minimum:

- **`profiles`** — role, name, email, phone, `phone_verified_at`, Stripe customer, verification flags
- **`riders`** — per-rider fields used in app: `rating`, `wallet_balance`, `is_verified_id` (plus defaults on insert in `lib/auth.ts`)
- **`drivers`** — approval, Stripe Connect flags, compliance columns (ABN, OCR, selfie scores, inspection expiry, etc. when migration `016` applied)
- **`trips`** — lifecycle fields, fare components, `stripe_payment_intent_id`, `offer_driver_id`, scheduling, tips, promo fields (per phase migrations)
- **`vehicles`** — linked to drivers for accept flow
- **`fare_config`** — active rows per `ride_type` with `platform_fee_percent` (used in `complete-trip`)
- **`driver_earnings_summary`** — view used by the driver **Earnings** tab (weekly net, payout status)
- **`notifications`**, **`trip_messages`** (with RLS notes in `PRODUCTION.md`)
- **`ratings`** — post-trip ratings (rider/driver breakdowns and `submit-rating` target)
- **`app_feature_flags`**, **`compliance_audit_log`**, **`driver_fraud_signals`**, **`driver_device_registrations`**, **`driver_phone_otp_challenges`** (compliance suite)

---

## 9. Configuration & environment

**Client (`EXPO_PUBLIC_*`):**

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required)
- `EXPO_PUBLIC_AUTH_EMAIL_REDIRECT`, `EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT` — optional; control signup confirmation / magic-link redirect targets (`lib/auth.ts`)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_ALLOW_CASH_BOOKING` — enables cash demo bookings without card
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_DRIVER_FF_OVERRIDES` — JSON overrides for driver compliance flags

**Edge / Supabase secrets:** See tables in `SETUP.md` (Stripe, webhook, Connect return URLs, cron secrets, Twilio, ABR, device salt, OCR, compliance cron, etc.).

---

## 10. Non-functional requirements (as implemented or documented)

- **Security:** Service-role edges for sensitive tables; RLS called out for production review (`PRODUCTION.md`)
- **Payments:** Manual capture + Connect; webhook-driven state
- **Compliance:** Australian-specific ABN; document types include `vehicle_inspection`, `driver_selfie`; audit and fraud tables when enabled
- **App Store:** Standard TLS only — `usesNonExemptEncryption: false` (`APPSTORE.md`)
- **Reliability:** Rider home uses raw `fetch` + timeouts for some Edge calls to avoid hangs (`riderEdge.ts` comment)

---

## 11. Roadmap / gaps (from internal docs, not promises)

**Repository-known gaps (mobile app vs stated product flows):**

- **Password recovery deep link:** `requestPasswordReset` uses `letsgo://reset-password`, but there is **no matching Expo route** under `app/` to complete password update in-app. Until added (or redirect changed to HTTPS web), password reset may only work where Supabase falls back to web Site URL.
- **Social login:** Dependencies exist but **no OAuth buttons or `app.config.js` plugins** — not part of current production UX.

`docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md` and `COMPLIANCE_RELEASE_CHECKLIST.md` list **optional hardening** and **partial** implementations (e.g. richer liveness than image similarity, unique phone index, self-hosted OCR). Treat those files as the living backlog for compliance depth.

---

## 12. Maintenance

**When to update this file**

- New Edge function or trip status
- New role, **route file**, or navigation guard
- Material change to payments or compliance gates
- New environment variables or migrations that change product behaviour

**Related files to keep in sync**

- `SETUP.md` — developer setup and secrets
- `PRODUCTION.md` — release checklist
- `docs/DRIVER_REGISTRATION_FEATURE_FLAGS.md` — flag semantics
- `docs/COMPLIANCE_RELEASE_CHECKLIST.md` — compliance operations

---

*End of knowledge base document.*
