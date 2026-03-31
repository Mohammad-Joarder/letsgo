# 🚗 "Lets Go" — AI Development Master Prompt
### A Premium Ride-Hailing App | Phased Build Prompts

---

## 🧱 TECH STACK & ARCHITECTURE CONTEXT
*(Carry this into every phase prompt so the AI never loses context)*

```
Mobile App : React Native (Expo SDK 54)
Backend    : Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
Admin Panel: React (Web, Vite-based)
Payments   : Stripe + Stripe Connect (for driver payouts)
Maps/Geo   : Google Maps SDK (react-native-maps), Google Places Autocomplete,
             Google Directions API, Google Distance Matrix API
Real-time  : Supabase Realtime channels (for live trip tracking, driver location)
Push Notif : Expo Notifications (FCM for Android, APNs for iOS)
Storage    : Supabase Storage (driver docs, profile photos)
Auth       : Supabase Auth (email/password + Google + Apple social login)
Secrets    : Supabase Edge Function secrets (never prefix with SUPABASE_)
State Mgmt : React Context + useReducer (no Redux)
Navigation : Expo Router (file-based routing)
UI Library : Custom components with NativeWind (Tailwind for RN)
```

**Project Structure**
```
/LetsGo          → React Native Expo app (rider + driver in one codebase, role-based routing)
/letsgo-admin    → React web admin panel
Supabase project → new project (separate from HelpingHandsAu)
```

**Design Philosophy:** Premium, dark-mode-first, clean like the best fintech apps.
Think Revolut meets Uber — not default Material Design. Every screen should feel
intentional. Use deep navy/charcoal backgrounds, electric accent colors (not purple),
smooth micro-animations, and map-centric layouts.

---

## 📋 PHASE OVERVIEW

| Phase | Theme | Key Deliverables |
|-------|-------|-----------------|
| 1 | Foundation | DB schema, Auth, role-based navigation shell |
| 2 | Rider Core | Booking flow, map, fare estimate, ride types |
| 3 | Driver Core | Driver app, trip accept/reject, navigation |
| 4 | Real-time Trip | Live tracking, status machine, in-trip experience |
| 5 | Payments | Stripe integration, fare calculation, payouts |
| 6 | Ratings & Safety | Dual ratings, SOS, trip recording, safety features |
| 7 | Driver Onboarding | Document upload, verification workflow, vehicle mgmt |
| 8 | Admin Panel | Dashboard, user mgmt, trip ops, surge pricing |
| 9 | Notifications & Comms | Push, in-app chat, SMS fallback |
| 10 | Polish & Production | Scheduled rides, promo codes, loyalty, App Store |

---

---

# PHASE 1 — Foundation: Database, Auth & Role-Based Shell

## 🎯 Goal
Set up the complete Supabase database schema for all app roles (Rider, Driver, Admin),
implement authentication with role detection, and build the empty navigation shell
that routes users to the correct experience based on their role.

---

## 📌 Prompt (Copy this directly to your AI tool)

```
You are building "Lets Go" — a premium ride-hailing mobile app (like Uber but more polished).
Tech stack:
- React Native with Expo SDK 54, Expo Router (file-based routing), NativeWind for styling
- Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- Admin panel: React + Vite (separate /letsgo-admin folder)

TASK: Build Phase 1 — Foundation.

--- DATABASE SCHEMA ---
Create a complete Supabase SQL migration file covering ALL of the following tables.
Apply RLS (Row Level Security) policies to every table. Use UUIDs as primary keys.
Include created_at/updated_at timestamps on all tables.

ENUMS:
- user_role: 'rider', 'driver', 'admin'
- driver_status: 'online', 'offline', 'on_trip'
- driver_approval_status: 'pending', 'under_review', 'approved', 'rejected', 'suspended'
- trip_status: 'searching', 'driver_accepted', 'driver_arrived', 'in_progress',
               'completed', 'cancelled', 'no_driver_found'
- ride_type: 'economy', 'comfort', 'premium', 'xl'
- payment_status: 'pending', 'authorised', 'captured', 'refunded', 'failed'
- payment_method_type: 'card', 'wallet', 'cash'
- vehicle_category: 'sedan', 'suv', 'van', 'luxury'
- cancellation_reason: 'rider_cancelled', 'driver_cancelled', 'no_show', 'app_issue'

TABLES:
1. profiles
   - id (uuid, references auth.users)
   - role (user_role)
   - full_name, email, phone, avatar_url
   - is_active, is_verified
   - stripe_customer_id

2. riders
   - id (uuid, references profiles)
   - rating (numeric 1-5, default 5.0)
   - total_trips (int)
   - preferred_payment_method (payment_method_type)
   - home_address, work_address (text)
   - wallet_balance (numeric, default 0)
   - is_verified_id (bool)

3. drivers
   - id (uuid, references profiles)
   - rating (numeric 1-5, default 5.0)
   - total_trips, total_earnings (numeric)
   - approval_status (driver_approval_status)
   - current_status (driver_status, default 'offline')
   - current_location (point) — PostGIS lat/lng
   - current_location_updated_at (timestamptz)
   - stripe_connect_account_id
   - stripe_connect_onboarded (bool)
   - license_number, license_expiry
   - bank_bsb, bank_account_number
   - background_check_passed (bool)
   - is_online (bool, default false)

4. vehicles
   - id (uuid)
   - driver_id (references drivers)
   - make, model, color, year (int)
   - plate_number
   - category (vehicle_category)
   - ride_type (ride_type)
   - is_active (bool)
   - is_approved (bool)
   - seat_count (int)
   - registration_expiry (date)

5. driver_documents
   - id (uuid)
   - driver_id (references drivers)
   - document_type (enum: 'license_front','license_back','vehicle_registration',
                           'insurance','profile_photo','vehicle_photo')
   - storage_path (text)
   - is_verified (bool)
   - verified_at (timestamptz)
   - verified_by (uuid, references profiles)
   - rejection_reason (text)

6. trips
   - id (uuid)
   - rider_id (references riders)
   - driver_id (references drivers, nullable)
   - vehicle_id (references vehicles, nullable)
   - ride_type (ride_type)
   - status (trip_status)
   - pickup_address, dropoff_address (text)
   - pickup_lat, pickup_lng, dropoff_lat, dropoff_lng (numeric)
   - estimated_distance_km (numeric)
   - estimated_duration_min (int)
   - estimated_fare (numeric)
   - final_fare (numeric, nullable)
   - surge_multiplier (numeric, default 1.0)
   - base_fare, distance_fare, time_fare, platform_fee (numeric)
   - scheduled_for (timestamptz, nullable) — for advance bookings
   - pickup_pin (text, 4 chars) — PIN verification
   - rider_rating, driver_rating (numeric, nullable)
   - rider_tip (numeric, default 0)
   - payment_status (payment_status)
   - payment_method (payment_method_type)
   - stripe_payment_intent_id (text)
   - cancellation_reason (cancellation_reason, nullable)
   - cancelled_by (uuid, nullable)
   - cancelled_at (timestamptz, nullable)
   - driver_arrived_at, trip_started_at, trip_completed_at (timestamptz)
   - notes (text) — rider notes to driver

7. trip_locations (breadcrumb trail for real-time tracking)
   - id (uuid)
   - trip_id (references trips)
   - lat, lng (numeric)
   - recorded_at (timestamptz)

8. fare_config (admin-configurable pricing table)
   - id (uuid)
   - ride_type (ride_type, unique)
   - base_fare (numeric)
   - per_km_rate (numeric)
   - per_min_rate (numeric)
   - minimum_fare (numeric)
   - platform_fee_percent (numeric)
   - cancellation_fee (numeric)
   - is_active (bool)

9. surge_zones
   - id (uuid)
   - name (text)
   - polygon (jsonb) — GeoJSON polygon
   - multiplier (numeric)
   - is_active (bool)
   - starts_at, ends_at (timestamptz, nullable)

10. promotions
    - id (uuid)
    - code (text, unique)
    - discount_type (enum: 'percent', 'fixed')
    - discount_value (numeric)
    - min_fare (numeric)
    - max_discount (numeric)
    - valid_from, valid_until (timestamptz)
    - max_uses (int)
    - uses_count (int, default 0)
    - per_user_limit (int)
    - ride_types (ride_type[], nullable — null means all)
    - is_active (bool)

11. rider_promotions (tracks per-user promo usage)
    - id (uuid)
    - rider_id (references riders)
    - promotion_id (references promotions)
    - trip_id (references trips)
    - used_at (timestamptz)

12. ratings
    - id (uuid)
    - trip_id (references trips)
    - from_user_id, to_user_id (uuid, references profiles)
    - rating (numeric 1-5)
    - comment (text)
    - tags (text[]) — e.g. ['clean_car','friendly','on_time']

13. support_tickets
    - id (uuid)
    - user_id (references profiles)
    - trip_id (references trips, nullable)
    - category (text)
    - subject, description (text)
    - status (enum: 'open','in_progress','resolved','closed')
    - admin_notes (text)
    - resolved_at (timestamptz)

14. notifications (in-app notification log)
    - id (uuid)
    - user_id (references profiles)
    - title, body (text)
    - type (text) — 'trip_update','payment','promo','system'
    - data (jsonb)
    - is_read (bool, default false)
    - created_at (timestamptz)

15. driver_earnings_summary (materialised weekly view, or table updated by trigger)
    - id (uuid)
    - driver_id (references drivers)
    - week_start (date)
    - total_trips, total_gross, platform_fee_total, net_earnings, tips_total (numeric)
    - stripe_payout_id (text)
    - payout_status (enum: 'pending','processing','paid','failed')

RLS POLICIES (apply to every table):
- profiles: users can read/update their own profile; admin can read all
- riders/drivers: owner can read/update their own record; admin full access
- trips: rider can see their own trips; driver can see trips assigned to them; admin all
- driver_documents: driver can manage their own; admin can read all
- vehicles: driver can manage their own; admin can read all
- ratings: involved parties can read; admin all
- fare_config: read by all authenticated; write by admin only
- surge_zones: read by all authenticated; write by admin only
- promotions: read by all; write by admin
- notifications: user can read/update their own

Also enable PostGIS extension for location queries.

--- SUPABASE EDGE FUNCTIONS ---
Create stub files (not yet implemented) for:
- get-fare-estimate
- search-nearby-drivers
- create-trip
- assign-driver
- update-driver-location
- complete-trip
- create-payment-intent
- stripe-webhook
- create-connect-account
- create-payout
- send-push-notification

--- MOBILE APP SHELL (/LetsGo) ---
Using Expo Router with file-based routing. NativeWind for styling.

Create the full folder structure:
app/
  (auth)/
    index.tsx          — landing/welcome screen
    sign-in.tsx
    sign-up.tsx
    forgot-password.tsx
    verify-otp.tsx
  (rider)/
    _layout.tsx        — tab navigator for rider
    home.tsx           — empty shell (map view placeholder)
    my-rides.tsx       — empty shell
    account.tsx        — empty shell
  (driver)/
    _layout.tsx        — tab navigator for driver
    home.tsx           — empty shell (driver dashboard)
    earnings.tsx       — empty shell
    account.tsx        — empty shell
  (admin)/             — web admin, handled separately
  _layout.tsx          — root layout with auth gate + role routing
  +not-found.tsx

components/
  ui/
    Button.tsx         — premium styled button (primary, secondary, ghost variants)
    Input.tsx          — styled text input
    Card.tsx
    Badge.tsx
    Avatar.tsx
    LoadingSpinner.tsx
    BottomSheet.tsx    — reusable bottom sheet
  shared/
    SafeAreaWrapper.tsx
    KeyboardAwareView.tsx

lib/
  supabase.ts          — Supabase client init
  auth.ts              — auth helpers
  constants.ts         — app constants, colors, ride type config

hooks/
  useAuth.ts           — auth context hook
  useProfile.ts        — current user profile hook

context/
  AuthContext.tsx      — global auth state

AUTH FLOW:
- On app launch, check Supabase session
- If no session → redirect to (auth)/index
- If session exists → read profile.role
  - role = 'rider' → redirect to (rider)/home
  - role = 'driver' → redirect to (driver)/home
  - role = 'admin' → show message "Use the web admin panel"
- Sign-up flow:
  1. Enter name, email, phone, password
  2. Confirm OTP (use Supabase OTP)
  3. Choose role (Rider or Driver)
  4. Create profile + rider/driver record
  5. If driver → show "your application is under review" screen

DESIGN SYSTEM:
Colors (define in constants.ts and NativeWind config):
  primary: '#00D4AA'        — electric teal
  background: '#0A0E1A'     — deep navy
  surface: '#131929'        — card surface
  surface2: '#1C2438'       — elevated surface
  text: '#FFFFFF'
  textSecondary: '#8A94A6'
  accent: '#FF6B35'         — orange for warnings/surge
  success: '#22C55E'
  error: '#EF4444'
  border: '#1E2D45'

Typography: Use expo-google-fonts with 'Sora' (headings) and 'Inter' (body)

The welcome screen should be premium:
- Dark background with subtle animated gradient mesh
- App logo "Lets Go" with a motion/speed visual motif
- "Get there, your way." tagline
- Two CTAs: "Sign In" and "Create Account"
- Clean, minimal, confident

Deliver:
1. Complete SQL migration file (supabase/migrations/001_initial_schema.sql)
2. All app/ files with proper Expo Router structure
3. lib/supabase.ts, lib/constants.ts
4. context/AuthContext.tsx
5. All UI components listed above
6. Welcome screen, Sign In, Sign Up, OTP screens — fully implemented with real Supabase auth
7. Role-based redirect logic working end-to-end
8. package.json with all required dependencies listed
9. app.config.js with necessary Expo config

Do NOT use placeholder logic — implement all auth calls with real Supabase SDK.
Prefer complete file outputs over diffs.
```

---

---

# PHASE 2 — Rider Core: Booking Flow & Fare Estimate

## 🎯 Goal
Build the full rider booking experience: map-based pickup/dropoff selection,
ride type selection, fare estimate, booking confirmation, and waiting state.

---

## 📌 Prompt

```
Continuing "Lets Go" app. Phase 1 (DB schema + auth shell) is complete.
Same tech stack: React Native / Expo SDK 54 / Expo Router / Supabase / Google Maps API / NativeWind.

TASK: Build Phase 2 — Rider Booking Flow.

--- SUPABASE EDGE FUNCTION: get-fare-estimate ---
Input: { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng }
Logic:
  1. Call Google Distance Matrix API to get distance_km and duration_min
  2. Read fare_config table for all active ride types
  3. Check surge_zones — if pickup point falls in an active surge polygon, apply multiplier
  4. For each ride_type calculate:
     fare = max(base_fare + (per_km_rate * distance_km) + (per_min_rate * duration_min), minimum_fare)
     fare = fare * surge_multiplier
     platform_fee = fare * platform_fee_percent
  5. Return array of ride options with all fare breakdown fields
  6. Also return: distance_km, duration_min, surge_active (bool), surge_multiplier

--- SUPABASE EDGE FUNCTION: search-nearby-drivers ---
Input: { pickup_lat, pickup_lng, ride_type, radius_km (default 5) }
Logic:
  1. Query drivers table where is_online=true AND current_status='online'
     AND approval_status='approved'
  2. Use PostGIS ST_DWithin to find drivers within radius
  3. Return array of: { driver_id, distance_m, eta_min (estimated), current_lat, current_lng }
  4. If no drivers found within 5km, return empty array with message

--- RIDER HOME SCREEN (app/(rider)/home.tsx) ---
This is the central screen — map-centric layout like Uber.

Layout (dark theme):
  TOP: Small header with user avatar + greeting
  CENTRE: Full-screen Google Maps (react-native-maps)
           - Show user's current location with a custom "You are here" marker
           - Show nearby available drivers as animated car icons on map
           - Real-time driver positions update via Supabase Realtime
  BOTTOM: Draggable bottom sheet (collapsed by default) with:
           "Where are you going?" search input (opens destination picker)

States this screen handles:
  STATE 1 — IDLE: Map shown, bottom sheet collapsed, nearby drivers visible
  STATE 2 — DESTINATION_SELECTION: Full-screen search with Google Places Autocomplete
             for both pickup and dropoff
  STATE 3 — RIDE_OPTIONS: Bottom sheet expanded showing:
             - Route preview on map (draw polyline between pickup/dropoff)
             - Ride type cards (Economy, Comfort, Premium, XL)
               Each card shows: icon, type name, est. time, est. price, seat count
             - Surge indicator if active (orange badge "1.8x Surge")
             - Promo code input field
             - Ride notes field ("Add a note for driver")
             - "Schedule for later" toggle
             - "Book [Ride Type] — $XX.XX" CTA button
  STATE 4 — CONFIRMING: Loading state, searching for drivers
             Show animated pulsing radar on map
  STATE 5 — WAITING_FOR_DRIVER: (covered in Phase 4)

COMPONENTS TO BUILD:
  components/rider/
    DestinationSearch.tsx    — Places autocomplete with recent searches
    RideTypeCard.tsx         — Individual ride option card
    RideOptionsSheet.tsx     — Full bottom sheet with all booking options
    RoutePolyline.tsx        — Map polyline drawer
    DriverMarker.tsx         — Animated car marker on map
    FareBreakdown.tsx        — Expandable fare detail accordion
    PromoCodeInput.tsx       — Promo code with validation against promotions table
    SchedulePicker.tsx       — Date/time picker for scheduled rides

DATA FLOW:
  1. On load: get user's current location (expo-location, ask permission)
  2. Query nearby drivers via search-nearby-drivers edge function (poll every 10s)
  3. When destination selected: call get-fare-estimate edge function
  4. User selects ride type → show fare for selected type
  5. User taps Book → validate promo (if any) → call create-trip edge function (stub)
     → navigate to trip waiting screen

DESIGN NOTES:
- Map should be styled with a dark custom map style (provide Google Maps JSON style)
- Bottom sheet should have glass-morphism effect
- Ride type cards animate in with stagger when sheet opens
- Selected ride type has glowing border effect
- Fare amount should be large and prominent
- Surge pricing shown with pulsing orange indicator

SCREENS ALSO NEEDED:
  app/(rider)/my-rides.tsx — Trip history list
    - Segmented tabs: "Upcoming" | "Past"
    - Trip card: date, route summary, fare, status badge, rating given
    - Tap to open trip detail modal

  app/(rider)/account.tsx — Rider profile
    - Profile photo, name, rating (stars)
    - Payment methods section (list saved cards, "Add Card" button)
    - Promotions/wallet section
    - Settings: notifications, safety, help
    - Sign out

Deliver complete, working file implementations. No stubs on screens.
Use Supabase SDK for all data fetching. Handle loading + error states on every screen.
```

---

---

# PHASE 3 — Driver Core: Dashboard, Trip Requests & Navigation

## 🎯 Goal
Build the complete driver-side experience: online/offline toggle, incoming trip request
handling (accept/reject with countdown), navigation to pickup, and all driver screens.

---

## 📌 Prompt

```
Continuing "Lets Go" app. Phases 1–2 complete (DB, auth, rider booking).
Same tech stack. TASK: Build Phase 3 — Driver Core.

--- SUPABASE EDGE FUNCTION: create-trip (complete implementation) ---
Input: { rider_id, ride_type, pickup_*, dropoff_*, estimated_*, scheduled_for?, notes? }
Logic:
  1. Insert trip record with status='searching'
  2. Generate 4-digit pickup_pin
  3. Call search-nearby-drivers to get candidate driver list
  4. Broadcast trip offer to nearest available driver via Supabase Realtime
     (channel: 'driver_trip_offers:[driver_id]')
  5. If driver doesn't respond in 15 seconds → try next driver
  6. Return { trip_id, pickup_pin, status }

--- SUPABASE EDGE FUNCTION: assign-driver ---
Input: { trip_id, driver_id, action: 'accept' | 'reject' }
Logic:
  - accept: update trip status to 'driver_accepted', set driver_id, vehicle_id
            update driver current_status to 'on_trip'
            notify rider via Realtime channel 'trip_updates:[trip_id]'
  - reject: mark driver as skip for this trip, offer to next driver

--- DRIVER HOME SCREEN (app/(driver)/home.tsx) ---
This is the driver's main operational screen.

Layout:
  TOP: Status bar — Online/Offline toggle (large, prominent)
       If online: green pulsing dot + "You are online"
       If offline: grey + "Go online to receive trips"
  CENTRE: Full-screen map showing driver's current location
           Auto-updates location every 5 seconds when online
           Calls update-driver-location edge function
  BOTTOM PANEL (when online): Small stats bar
           Today's trips | Today's earnings | Current rating

ONLINE/OFFLINE TOGGLE LOGIC:
  - Toggle calls Supabase to update drivers.is_online + current_status
  - When going online: request location permission, start location tracking
  - When going offline: stop tracking, ensure no active trip

TRIP REQUEST MODAL (appears as full-screen overlay when trip offered):
  Shows:
  - Rider name + rating + is_verified badge
  - Ride type badge (Economy/Premium/etc)
  - Pickup location name
  - Dropoff location name + estimated distance
  - Estimated earnings (fare - platform_fee)
  - Map snippet showing pickup pin
  - Countdown timer (15 seconds, animated circular progress)
  - Large "ACCEPT" button (green) + "DECLINE" text button

  On Accept: call assign-driver(accept) → navigate to pickup navigation
  On Decline or timeout: call assign-driver(reject) → modal dismisses

PICKUP NAVIGATION SCREEN (app/(driver)/pickup-navigation.tsx):
  - Full-screen map with route from driver to pickup point
  - Turn-by-turn directions using Google Directions API (draw polyline)
  - Top bar: "Heading to pickup — X min away"
  - Bottom panel:
    - Rider name, phone (tap to call via tel: link)
    - In-app message button
    - Pickup address
    - "I've Arrived" button (only enabled when within 200m of pickup)
  - On "I've Arrived": update trip status to 'driver_arrived'
                       start wait timer (for wait-time fees)

TRIP IN PROGRESS SCREEN (app/(driver)/trip-active.tsx):
  - Map with route to dropoff
  - TOP bar: PIN verification prompt — "Ask rider for 4-digit PIN"
             Show PIN input for driver to confirm
             (Only allow trip start after PIN matches trips.pickup_pin)
  - After PIN confirmed: start navigation to dropoff
  - Bottom panel:
    - Rider name
    - Dropoff address
    - Running timer + estimated arrival
    - "End Trip" button (only when within 300m of dropoff)
  - On "End Trip": update trip status to 'completed'
                   update driver status to 'online'
                   navigate to trip summary

TRIP SUMMARY SCREEN (app/(driver)/trip-summary.tsx):
  - Earnings breakdown: base + distance + time + tip - platform_fee = net
  - Route shown on map (replay)
  - Rate Rider: 1-5 stars + optional tags + comment
  - "Back to Home" CTA

--- DRIVER SCREENS ---
app/(driver)/earnings.tsx:
  - Weekly earnings chart (line chart with react-native-gifted-charts)
  - Summary cards: This week | Total | Pending payout
  - Trip history list with per-trip earnings
  - "Request Payout" button (calls create-payout edge function)
  - Payout history section

app/(driver)/account.tsx:
  - Profile: photo, name, rating, total trips, approval status badge
  - Vehicle information card
  - Documents status (verified/pending per document type)
  - Bank details section (BSB + account, masked)
  - Ratings & Reviews tab
  - Settings: notification prefs, navigation app preference (Google/Waze/Apple)
  - Sign out

--- UPDATE-DRIVER-LOCATION EDGE FUNCTION ---
Input: { driver_id, lat, lng }
Logic:
  1. Update drivers.current_location (PostGIS point) and current_location_updated_at
  2. If driver is on a trip, also insert into trip_locations table
  3. Broadcast to Realtime channel 'driver_location:[driver_id]'

Deliver all files completely. No TODO stubs. Handle all edge cases (no location permission, trip timeout, network errors). Use optimistic UI where possible for snappy feel.
```

---

---

# PHASE 4 — Real-Time Trip Experience: Live Tracking & Status Machine

## 🎯 Goal
Connect rider and driver apps via Supabase Realtime. Build the live trip tracking
experience for the rider — seeing the driver move on the map in real time.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–3 complete. TASK: Build Phase 4 — Real-Time Trip.

--- SUPABASE REALTIME ARCHITECTURE ---
Use these Realtime channel conventions:
  'driver_trip_offers:[driver_id]'  — incoming trip offers to a specific driver
  'trip_updates:[trip_id]'          — all parties subscribe for status changes
  'driver_location:[driver_id]'     — driver broadcasts location, rider subscribes

All location/status updates use Supabase Realtime broadcast (not DB changes)
for lower latency. DB writes happen in background.

--- RIDER: TRIP TRACKING SCREENS ---

SEARCHING SCREEN (shown after booking, waiting for driver assignment):
  - Animated radar pulse on map
  - "Finding your driver..." pulsing text
  - Estimated wait time
  - Option to cancel (free cancellation within 30s of booking)
  - Subscribe to 'trip_updates:[trip_id]' channel
  - When status changes to 'driver_accepted' → auto-navigate to tracking screen

DRIVER FOUND SCREEN (status = driver_accepted):
  Animate in from bottom:
  - Driver photo + name + rating
  - Vehicle: make, model, color, plate number
  - Verified badge (if rider is verified)
  - "Driver is X min away" with countdown
  - Map: show driver moving toward pickup in real time
  - Call driver (tel: link) + Chat button
  - "Cancel" option (cancellation fee may apply)
  - Pickup PIN displayed prominently: "Show this PIN to your driver: [XXXX]"

IN-TRIP TRACKING SCREEN (status = in_progress):
  - Full-screen map showing:
    - Driver's real-time position (smooth interpolated movement)
    - Route polyline to dropoff
    - Pickup and dropoff markers
  - Collapsed bottom panel showing:
    - Driver name
    - ETA to dropoff
    - Trip fare (live, not shown until end)
  - Share trip button: generates a link with trip_id for safety sharing
  - Emergency SOS button (top right, red)

TRIP COMPLETED SCREEN (status = completed):
  - Map replay or static route display
  - Total fare with breakdown accordion
  - Tip selector: $1 / $2 / $5 / Custom
  - Rate driver: 1-5 stars (required before dismissing)
  - Tag chips: "Clean car" / "Great chat" / "On time" / "Safe driver" / "Quiet"
  - Comment field (optional)
  - Submit rating → save to ratings table, update tip on trip
  - "Book Again" CTA

--- DRIVER REAL-TIME LOCATION BROADCASTING ---
When driver is on a trip:
  1. Start foreground location tracking (expo-location watchPositionAsync, 2s interval)
  2. Each update: call update-driver-location edge function
  3. Edge function broadcasts lat/lng on 'driver_location:[driver_id]' channel

Rider app subscribes to that channel and smoothly animates the driver marker
using interpolated coordinates (not teleporting — smooth movement).

--- SMOOTH MARKER ANIMATION ---
Implement animated driver marker that:
  - Rotates to face direction of travel (calculate bearing from previous to current point)
  - Moves smoothly between GPS updates using React Native Animated interpolation
  - Uses a custom car SVG icon, rotated by bearing angle

--- TRIP STATUS STATE MACHINE ---
Implement a useTripStatus hook that:
  - Takes trip_id as input
  - Subscribes to 'trip_updates:[trip_id]' Supabase Realtime channel
  - Maintains local trip state
  - On status change → emits event for screen to handle navigation
  - Automatically unsubscribes on unmount

Valid transitions:
  searching → driver_accepted | no_driver_found | cancelled
  driver_accepted → driver_arrived | cancelled
  driver_arrived → in_progress | cancelled
  in_progress → completed

--- CANCELLATION FLOW ---
If rider cancels:
  - Before driver accepted: free cancellation
  - After driver accepted (>2 min): show warning "Cancellation fee of $X applies"
  - Confirm → update trip status, process cancellation_fee via Stripe if applicable
  - Update driver status back to 'online'

ALSO BUILD:
  hooks/useDriverLocation.ts    — subscribes to driver location realtime channel
  hooks/useTripStatus.ts        — trip status state machine hook
  hooks/useNearbyDrivers.ts     — polls nearby drivers every 10s for home screen
  utils/geo.ts                  — bearing calculation, distance helpers, coordinate interpolation

Deliver complete file implementations. All realtime subscriptions must handle
reconnection gracefully. Implement exponential backoff for location broadcast failures.
```

---

---

# PHASE 5 — Payments: Stripe Integration & Driver Payouts

## 🎯 Goal
Implement full Stripe payment flow for riders (card-on-file charging per trip),
Stripe Connect for driver payouts, and the wallet/earnings system.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–4 complete. TASK: Build Phase 5 — Payments.

IMPORTANT SUPABASE SECRETS RULE: Never prefix edge function secrets with 'SUPABASE_'.
Use secret names: STRIPE_SECRET_KEY, SERVICE_ROLE_KEY, STRIPE_WEBHOOK_SECRET.
Stripe test keys are used throughout. Switch to live keys only for production.

--- EDGE FUNCTION: create-payment-intent ---
Input: { trip_id, amount_cents, rider_id, payment_method_id? }
Logic:
  1. Read rider.stripe_customer_id — create Stripe customer if null
  2. Create Stripe PaymentIntent with:
     - amount: amount_cents
     - currency: 'aud'
     - customer: stripe_customer_id
     - capture_method: 'manual' (authorise now, capture on trip completion)
     - payment_method: payment_method_id (if saved card) or leave for client to attach
     - metadata: { trip_id, rider_id }
  3. Update trip.stripe_payment_intent_id
  4. Return { client_secret, payment_intent_id }

--- EDGE FUNCTION: stripe-webhook ---
Handle these Stripe events:
  - payment_intent.succeeded → update trip.payment_status = 'captured'
  - payment_intent.payment_failed → update trip.payment_status = 'failed'
                                     notify rider to update payment method
  - transfer.created → update driver_earnings_summary payout_status
  - account.updated → update drivers.stripe_connect_onboarded if charges_enabled=true

Verify webhook signature using STRIPE_WEBHOOK_SECRET.
Always return 200 immediately, process async.

--- EDGE FUNCTION: create-connect-account ---
Input: { driver_id }
Logic:
  1. Create Stripe Connect Express account with:
     - type: 'express'
     - country: 'AU'
     - capabilities: { card_payments: { requested: true }, transfers: { requested: true } }
     - business_type: 'individual'
  2. Save account_id to drivers.stripe_connect_account_id
  3. Create Account Link for onboarding
  4. Return { account_id, onboarding_url }

--- EDGE FUNCTION: create-payout ---
Input: { driver_id, amount_cents }
Logic:
  1. Verify driver is approved + stripe_connect_onboarded=true
  2. Verify requested amount <= driver's unpaid net earnings
  3. Create Stripe Transfer to driver's Connect account:
     - amount: amount_cents
     - currency: 'aud'
     - destination: driver.stripe_connect_account_id
  4. Create Stripe Payout on Connect account
  5. Update driver_earnings_summary payout fields
  6. Return { payout_id, estimated_arrival }

--- PAYMENT CAPTURE ON TRIP COMPLETION ---
In the complete-trip edge function (build this now if not yet done):
  Input: { trip_id, driver_id }
  Logic:
    1. Verify driver is on this trip
    2. Calculate final_fare (may differ from estimate if route changed)
    3. Add rider_tip to final_fare
    4. Capture the Stripe PaymentIntent (partial capture if final < estimated)
    5. Calculate platform_fee = final_fare * fare_config.platform_fee_percent
    6. Create Stripe Transfer (final_fare - platform_fee) to driver Connect account
    7. Update trip: status=completed, final_fare, payment_status='captured', completed_at
    8. Update driver earnings summary
    9. Update rider/driver total_trips counts
    10. Broadcast status change on trip_updates channel

--- RIDER: PAYMENT MANAGEMENT UI ---

components/rider/PaymentMethodManager.tsx:
  - List saved payment methods from Stripe (via fetch customer payment methods)
  - Add new card: use @stripe/stripe-react-native CardField component
  - Set default payment method
  - Delete card (with confirmation)
  - Show "No cards saved" empty state

Payment flow on booking:
  1. When rider books a trip, show payment method selector at bottom of RideOptionsSheet
  2. If no card saved → require adding card before booking
  3. On confirm → create-payment-intent → use Stripe SDK to confirm payment intent
     (authorize only, not capture)
  4. If 3DS required → handle authentication challenge in-app

Wallet section in account screen:
  - Show wallet_balance
  - Option to top up wallet (future phase)
  - Wallet used as fallback or preference

--- DRIVER: STRIPE CONNECT ONBOARDING UI ---
app/(driver)/stripe-onboarding.tsx:
  - Shown if driver.stripe_connect_onboarded = false
  - Explain what it's for (to receive payments)
  - "Set Up Payments" button → calls create-connect-account → opens onboarding_url
    in expo-web-browser (WebBrowser.openBrowserAsync)
  - On return from browser → re-check onboarding status
  - Show success state when onboarded

Include @stripe/stripe-react-native setup instructions in a SETUP.md file.
Document all required Stripe webhook events to configure in Stripe dashboard.
```

---

---

# PHASE 6 — Ratings, Safety & Trust Features

## 🎯 Goal
Implement the dual rating system, safety features (SOS, PIN verification, trip sharing),
driver preference settings, and the trust/verification layer.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–5 complete. TASK: Build Phase 6 — Ratings & Safety.

--- DUAL RATING SYSTEM ---
After each trip, both rider and driver must rate each other.

Rating submission:
  - Write to ratings table (from_user_id, to_user_id, trip_id, rating, comment, tags)
  - After each rating submission, recalculate the target user's average rating:
    UPDATE riders/drivers SET rating = (SELECT AVG(rating) FROM ratings WHERE to_user_id = ?)
  - Ratings can only be submitted once per trip per direction
  - Ratings are submitted within 24h of trip completion; after that trip is locked

Rating tags:
  For driver rating: ['Great driver', 'Safe driver', 'Clean car', 'On time', 'Friendly', 'Quiet ride']
  For rider rating: ['Great passenger', 'On time', 'Respectful', 'Clean', 'Easy to find']

Build a RatingModal component used in both rider and driver post-trip screens.

--- SAFETY FEATURES ---

1. PIN VERIFICATION
   - trips.pickup_pin is a random 4-digit code generated at booking
   - Rider sees PIN on "Driver Found" screen: "Show this PIN to your driver"
   - Driver enters PIN on trip-active screen before trip can start
   - PIN validation done locally (driver app has the trip record)
   - Mismatch shows error: "Incorrect PIN — please verify you are in the right vehicle"

2. SOS / EMERGENCY BUTTON
   - Visible on all active trip screens (rider and driver) as a red shield icon
   - Tap → confirm modal "Send SOS alert?"
   - On confirm:
     a. Update trip record with sos_triggered=true, sos_at=now()
     b. Create support ticket with category='safety_emergency'
     c. Send push notification to admin
     d. Open phone dialler to local emergency number (000 for AU)
   - Add sos_triggered (bool) and sos_at (timestamptz) columns to trips table

3. SHARE TRIP
   - "Share my trip" button on in-trip rider screen
   - Generates shareable URL: https://letsgo.app/track/[trip_id]
   - Copies to clipboard + opens share sheet (expo-sharing)
   - (The actual tracking page is admin panel territory — stub for now)

4. DRIVER MIN RIDER RATING PREFERENCE
   - In driver account settings: "Minimum rider rating" slider (3.5 / 4.0 / 4.5 / None)
   - Save to drivers table: min_rider_rating (numeric, nullable)
   - search-nearby-drivers filters out riders below driver's min_rider_rating

5. RIDER ID VERIFICATION BADGE
   - In rider account: "Verify your identity" section
   - Upload government ID photo (Supabase storage)
   - Admin reviews and sets riders.is_verified_id = true
   - "Verified" badge appears on trip requests shown to drivers

6. TRIP RECORDING (Record My Ride)
   - Toggle in driver app settings: "Record my ride"
   - If enabled, uses expo-av to record audio during active trips
   - Recording stored locally on device only (not uploaded)
   - After trip: "Trip recording saved to your device. Expires in 7 days."
   - Note shown: "For safety review only — not accessible by Let's Go"

--- RATINGS DISPLAY ---
Driver profile in rider app (tappable from "Driver Found" screen):
  - Full-screen bottom sheet with:
    - Driver photo, name, rating (large star display)
    - Total trips, member since
    - Vehicle details
    - Recent reviews (last 5, anonymous from riders)
    - Tags word cloud

Rider's own rating display in account:
  - Current rating + breakdown (how many 1-star, 2-star, etc.)
  - Tips to improve rating

--- SUPPORT TICKET FLOW ---
app/(rider)/help.tsx and app/(driver)/help.tsx:
  - Category selection: Payment issue / Trip issue / Account / Safety / Other
  - If trip-related: link to a recent trip (picker)
  - Subject + description fields
  - Submit → insert to support_tickets table
  - View existing tickets with status badges

Deliver complete implementations. Update the trips table migration to add sos columns.
```

---

---

# PHASE 7 — Driver Onboarding: Document Upload & Verification

## 🎯 Goal
Build the full driver registration and document verification workflow —
from sign-up through document upload to admin approval and vehicle setup.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–6 complete. TASK: Build Phase 7 — Driver Onboarding.

--- DRIVER ONBOARDING FLOW ---
After a driver registers, they go through an onboarding wizard before they can go online.

app/(driver)/onboarding/
  _layout.tsx          — Wizard layout with step progress bar
  step1-personal.tsx   — Personal details (already have from signup, but verify)
  step2-license.tsx    — Upload driving license (front + back photo)
  step3-vehicle.tsx    — Add vehicle details (make, model, color, year, plate, category)
  step4-vehicle-docs.tsx — Upload: vehicle registration + insurance certificate
  step5-vehicle-photo.tsx — Upload vehicle photo
  step6-profile-photo.tsx — Upload clear face photo
  step7-bank.tsx       — Bank account details (BSB + account number)
  step8-review.tsx     — Summary of all submitted info
  step9-submitted.tsx  — "Application submitted — we'll review within 24 hours"

DOCUMENT UPLOAD LOGIC:
  - Use expo-image-picker for camera/gallery selection
  - Upload to Supabase Storage bucket: 'driver-documents' (private bucket, RLS protected)
  - Storage path: driver_documents/[driver_id]/[document_type]/[uuid].[ext]
  - After upload, insert record to driver_documents table
  - Show upload progress bar
  - Allow re-upload if rejected

VEHICLE SETUP:
  - Form: make (text), model (text), color (color picker), year (number),
          plate_number (text, uppercase), category (sedan/suv/van/luxury),
          ride_type (economy/comfort/premium/xl), seat_count (number)
  - Insert to vehicles table

BANK DETAILS:
  - BSB: 6-digit (formatted as XXX-XXX)
  - Account number: validated format
  - Stored in drivers table (bank_bsb, bank_account_number)
  - These are used when creating the Stripe payout (combined with Connect account)
  - Show security notice: "Your details are encrypted and secure"

ONBOARDING STATUS SCREEN:
  If driver is approved but hasn't done Stripe Connect onboarding:
    → Show Stripe onboarding prompt
  If driver is pending/under_review:
    → Show status screen with estimated review time
    → Show which documents are approved/pending/rejected
    → If any document rejected: show rejection reason + "Re-upload" button

DOCUMENT STATUS TRACKING:
  - Per document, show: pending (grey) / approved (green check) / rejected (red x)
  - Rejection reason shown below rejected documents
  - "Re-upload" triggers the same upload flow for just that document

--- UPDATE ONBOARDING STATUS CHECK IN AUTH ---
Update the root _layout.tsx:
  When role = 'driver':
    - Check driver.approval_status
    - If 'pending' or 'under_review' → redirect to onboarding status screen
    - If 'rejected' → show rejection reason screen with support link
    - If 'suspended' → show suspension notice
    - If 'approved' + not stripe_connect_onboarded → redirect to stripe onboarding
    - If 'approved' + stripe_connect_onboarded → proceed to driver home

--- VEHICLE MANAGEMENT ---
app/(driver)/account/vehicles.tsx:
  - List of driver's vehicles (usually one, can have multiple)
  - Active vehicle highlighted
  - Add vehicle CTA
  - Each vehicle: approval status badge, edit button
  - Note: vehicle changes require re-approval

Deliver complete wizard implementation with proper state persistence between steps
(use AsyncStorage to save wizard progress so user can resume if app closed).
All file uploads should show progress and handle errors gracefully.
```

---

---

# PHASE 8 — Admin Panel: Dashboard, Operations & Configuration

## 🎯 Goal
Build the React web admin panel with complete operational controls:
user management, trip oversight, driver verification, surge pricing controls, and analytics.

---

## 📌 Prompt

```
Build the "Lets Go" Admin Panel — a React + Vite web application in /letsgo-admin.

This is a professional operations dashboard used by the platform team.
Tech: React, Vite, TypeScript, TailwindCSS, Supabase JS client, Recharts for charts,
      React Router v6, React Query for data fetching.

Design: Dark mode dashboard, similar to Vercel/Linear aesthetic.
Colors: Background #0A0E1A, Surface #131929, Accent #00D4AA, Border #1E2D45
Use Inter font. Sidebar navigation.

--- AUTHENTICATION ---
Admin login (email/password via Supabase auth).
After login, verify profile.role = 'admin'. Otherwise show "Access denied".
Admin accounts are created manually in Supabase — no self-registration.

--- NAVIGATION SIDEBAR ---
Dashboard | Trips | Drivers | Riders | Payments | Pricing | Promotions | Support | Settings

--- PAGE: DASHBOARD ---
4 metric cards (real-time):
  - Active trips right now
  - Drivers online right now
  - Revenue today ($)
  - Rides today (count)

Charts (Recharts):
  - Revenue last 7 days (bar chart)
  - Trips per hour today (line chart)
  - Ride type breakdown (donut chart)

Live map section:
  - All online drivers shown as dots (using Google Maps JS API)
  - Active trips shown as routes

Recent activity feed:
  - Last 10 trips with status badges (auto-refreshing every 30s)

--- PAGE: TRIPS ---
Filterable data table:
  Filters: Status | Ride Type | Date Range | Surge Only
  Columns: Trip ID | Rider | Driver | Pickup | Dropoff | Fare | Status | Started | Duration
  Actions: View detail | Cancel (if active)

Trip Detail Modal:
  - Full trip info
  - Map replay of route (using trip_locations breadcrumb data)
  - Rider + driver names (clickable → profile)
  - Fare breakdown
  - Payment status
  - SOS flag if triggered
  - Timeline of status changes with timestamps
  - Ratings given

--- PAGE: DRIVERS ---
Tabs: All | Pending Review | Approved | Suspended

Driver list table: Name | Status | Approval | Rating | Total Trips | Join Date | Online now

Driver Detail Page:
  - All profile info
  - Document viewer (each document type with approve/reject buttons)
  - Rejection reason text input (required when rejecting)
  - Approval status control: Approve | Reject | Suspend | Unsuspend
  - Vehicle details + approval toggle
  - Earnings history
  - Trip history
  - Ratings received
  - Stripe Connect status

Document Review Workflow:
  - Click document → open full-size image (from Supabase Storage signed URL)
  - Approve button → mark verified
  - Reject button → require reason → save rejection reason
  - When ALL required documents approved → offer "Approve Driver" button

--- PAGE: RIDERS ---
Rider list: Name | Rating | Total Trips | Join Date | Verified ID | Wallet Balance
Rider Detail:
  - Profile info
  - Trip history
  - Ratings received
  - Payment methods on file (via Stripe customer)
  - ID verification: view uploaded ID, approve verification badge
  - Suspend/unsuspend account

--- PAGE: PAYMENTS ---
Tabs: Transactions | Driver Payouts | Refunds

Transactions table: Trip | Rider | Amount | Status | Date | Stripe PI ID
Driver Payouts table: Driver | Amount | Status | Stripe Payout ID | Date
Refund Management:
  - Select trip → issue full or partial refund via Stripe API
  - Refund reason required
  - Confirmation step before processing

--- PAGE: PRICING ---
Fare Configuration (per ride type):
  Table of all ride types with editable fields:
  - Base fare | Per km | Per min | Minimum fare | Platform fee % | Cancellation fee
  - Save button per row (or bulk save)
  - Changes take effect immediately (fare_config table)

Surge Zone Manager:
  - List of surge zones with on/off toggles
  - "Add Surge Zone" button → opens map polygon drawer
  - Set multiplier (1.1x to 3.0x) + optional time window
  - Active surge zones shown with pulsing indicator

--- PAGE: PROMOTIONS ---
Promo code management:
  - Create promo: code, type (% or fixed), value, min fare, max discount,
                  valid dates, max uses, per-user limit, applicable ride types
  - List all promos with active/expired/draft status
  - Usage analytics: how many times used, total discount given
  - Disable/enable toggle

--- PAGE: SUPPORT ---
Ticket list: All | Open | In Progress | Resolved
Filters: Category | Priority | Date
Ticket detail panel:
  - User info + trip link
  - Ticket description
  - Admin notes textarea
  - Status control: Open → In Progress → Resolved
  - Internal notes (not visible to user)

--- PAGE: SETTINGS ---
  - Platform name + logo upload
  - Admin user management (list admins, invite new admin by email)
  - Notification settings (which events trigger admin push)
  - Stripe webhook URL display
  - App version info

Deliver complete /letsgo-admin application. All data must come from Supabase (use
service_role key in backend operations, anon key for reads).
Build is clean TypeScript throughout. Mobile-responsive is not required — desktop only.
```

---

---

# PHASE 9 — Notifications, In-App Chat & Communications

## 🎯 Goal
Implement push notifications for all key trip events, in-app messaging between
rider and driver during a trip, and email notification triggers.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–8 complete. TASK: Build Phase 9 — Notifications & Comms.

--- PUSH NOTIFICATIONS SETUP ---
Use Expo Notifications (expo-notifications).
On app launch (after auth): request push permission, get Expo push token.
Save token to profiles table: add expo_push_token (text) column.

--- EDGE FUNCTION: send-push-notification ---
Input: { user_id, title, body, data: {} }
Logic:
  1. Fetch expo_push_token from profiles where id = user_id
  2. If no token, return gracefully
  3. POST to https://exp.host/--/api/v2/push/send with:
     { to: token, title, body, data, sound: 'default', badge: 1 }
  4. Log notification to notifications table
  5. Return receipt

--- NOTIFICATION TRIGGERS (call send-push-notification from other edge functions) ---

For RIDERS:
  - Driver found: "Your driver [Name] is on the way! [Car] [Plate]"
  - Driver arrived: "[Name] has arrived — look for [Color] [Car]"
  - Trip started: "Your trip has started. ETA: X minutes"
  - Trip completed: "Trip complete! $XX charged. Rate your driver?"
  - Driver cancelled: "Your driver cancelled. Finding another driver..."
  - No driver found: "Sorry, no drivers available. Please try again."
  - Payment failed: "Payment failed. Please update your payment method."
  - Promo code applied: "Promo applied! You saved $X on this trip"

For DRIVERS:
  - New trip offer: (handled via Realtime, but also push as backup)
  - Payout processed: "Your payout of $X is on its way!"
  - Document approved: "Your [document] has been verified"
  - Document rejected: "Your [document] needs attention"
  - Account approved: "Congratulations! You're approved. Go online to start earning!"
  - Account suspended: "Your account has been temporarily suspended"
  - Low rating warning: "Your rating has dropped below 4.0. See tips to improve."

For ADMINS:
  - SOS triggered: "🚨 SOS Alert — Trip [ID] — [Location]"
  - New driver application: "New driver application from [Name]"

--- IN-APP MESSAGING (RIDER ↔ DRIVER) ---
Only available during an active trip (status: driver_accepted through completed).

Add table:
  trip_messages:
    id (uuid), trip_id (references trips), sender_id (uuid, references profiles)
    body (text), sent_at (timestamptz), is_read (bool)

RLS: only rider and driver of the trip can read/write.

UI Component: TripChat.tsx
  - Bottom sheet chat interface with message bubbles
  - Send text messages
  - Predefined quick replies: "On my way" / "Almost there" / "I'll be there in 2 min"
                               "Where are you?" / "I'm outside" / "Running late"
  - New message badge on chat button in trip screens
  - Messages delivered via Supabase Realtime (subscribe to trip_messages INSERT events)
  - Show sender avatar (driver or rider silhouette)
  - Timestamp per message

Telephony:
  - "Call" button → opens phone's dialler with driver/rider phone number via tel: URL
  - Numbers are NOT shown directly — use tel: link only

--- IN-APP NOTIFICATION CENTER ---
app/(rider)/notifications.tsx + app/(driver)/notifications.tsx:
  - List of notifications from notifications table (most recent first)
  - Unread shown with highlight
  - Tap to navigate to relevant screen (based on notification.data.trip_id etc.)
  - "Mark all read" button
  - Badge count on tab bar icon driven by count of unread notifications

Add notification bell icon to rider/driver home screen headers with badge count.

--- EMAIL NOTIFICATIONS (via Supabase Auth + custom templates) ---
Configure Supabase email templates for:
  - Welcome email (on signup)
  - Password reset
  - Account approved (driver)
  - Account rejected (driver) — include rejection reasons
  - Weekly earnings summary (driver) — scheduled trigger or manual admin send

Document the email template configuration in SETUP.md.

Deliver complete implementations. All notification flows should be testable
with Expo Go. Ensure notification permissions are requested gracefully with
explanation context before the system dialog appears.
```

---

---

# PHASE 10 — Polish, Production Features & App Store Submission

## 🎯 Goal
Add the premium features that elevate "Lets Go" above competitors — scheduled rides,
promo system, loyalty tiers — then prepare for TestFlight beta and App Store submission.

---

## 📌 Prompt

```
Continuing "Lets Go". Phases 1–9 complete. TASK: Build Phase 10 — Polish & Production.

--- SCHEDULED RIDES ---
Riders can book a ride up to 7 days in advance.

Booking flow addition:
  - "Schedule for later" toggle in RideOptionsSheet
  - Date + time picker opens (expo-datetime-picker or custom)
  - Min: 30 min from now, Max: 7 days ahead
  - Stores trips.scheduled_for timestamp
  - Trip is created with status='searching' but drivers are NOT notified yet
  - A background job (pg_cron or Supabase scheduled Edge Function) polls every minute:
    SELECT trips WHERE status='searching' AND scheduled_for <= now() + interval '15 min'
    → trigger driver search process for these trips

Rider view of scheduled trips:
  - "Upcoming" tab in my-rides shows scheduled trips
  - Countdown timer: "Driver search begins in X hours Y min"
  - Cancel for free up to 15 min before scheduled_for
  - Trip card shows: scheduled time, route, ride type, estimated fare

Driver notification:
  - Same incoming trip offer flow, just triggered at the scheduled time
  - Trip offer shows "Scheduled pickup at [time]" badge

--- PROMO CODE SYSTEM (complete implementation) ---
PromoCodeInput already exists from Phase 2 — now wire it to full backend logic.

Edge function: validate-promo
Input: { code, rider_id, trip_fare, ride_type }
Logic:
  1. Find promotion by code where is_active=true and now() between valid_from and valid_until
  2. Check uses_count < max_uses
  3. Check rider hasn't exceeded per_user_limit (query rider_promotions)
  4. Check trip_fare >= min_fare
  5. Check ride_type in promotion.ride_types (or null = all types)
  6. Calculate discount:
     if percent: discount = min(trip_fare * discount_value/100, max_discount)
     if fixed: discount = min(discount_value, max_discount)
  7. Return { valid: true, discount_amount, final_fare, promo_id }
     or { valid: false, error_message }

On trip completion, if promo used:
  - Insert to rider_promotions
  - Increment promotion.uses_count

--- LOYALTY / DRIVER PRO TIERS ---
Driver tier system (inspired by Uber Pro):

Add to drivers table:
  - tier (enum: 'standard', 'silver', 'gold', 'platinum')
  - tier_trips_this_period (int, resets monthly)

Tier thresholds (this month's trips):
  Standard: 0-19 trips
  Silver: 20-49 trips (5% fare bonus)
  Gold: 50-99 trips (8% fare bonus + priority matching)
  Platinum: 100+ trips (12% fare bonus + priority matching + dedicated support)

A Supabase function runs on trip completion:
  - Increment tier_trips_this_period
  - Check if tier threshold crossed → upgrade tier → send push notification

Driver home screen shows current tier with progress to next tier (ring progress widget).

--- GOOGLE & APPLE SOCIAL LOGIN ---
Implement in sign-in and sign-up screens:
  Google: use @react-native-google-signin/google-signin
    - Configure with Google Client ID for iOS and Android
    - Get ID token → supabase.auth.signInWithIdToken({ provider: 'google', token })
  Apple: use expo-apple-authentication (iOS only)
    - Get credential → supabase.auth.signInWithIdToken({ provider: 'apple', token })

Both create profile record if new user, then run role-selection flow if first time.

--- PERFORMANCE & POLISH ---

Loading skeletons:
  - Replace all loading spinners with shimmer skeleton components
  - Build SkeletonLoader.tsx (configurable width/height/borderRadius)
  - Apply to: trip cards, driver card, ride options, earnings list

Empty states:
  - Custom illustrated empty states for: no trips, no notifications, no drivers nearby
  - Use simple SVG illustrations (inline)

Error handling:
  - Global error boundary in root _layout.tsx
  - Network error banner (detects offline via NetInfo)
  - Retry buttons on all failed data fetch states

Animations:
  - Ride type cards: stagger entrance animation (react-native-reanimated)
  - Driver marker: smooth GPS interpolation (already in Phase 4, refine)
  - Bottom sheets: spring animation on open/close
  - Success screens: Lottie animation on trip completion

Map dark theme:
  Apply full custom Google Maps JSON style for dark mode.
  Provide the complete style JSON (muted roads, bright water, dark land).

--- APP STORE PREPARATION ---

app.config.js updates:
  - ios.bundleIdentifier: 'com.letsgo.app'
  - android.package: 'com.letsgo.app'
  - Version: 1.0.0 (build 1)
  - All required permissions with usage descriptions:
    NSLocationWhenInUseUsageDescription, NSLocationAlwaysUsageDescription (driver),
    NSCameraUsageDescription, NSPhotoLibraryUsageDescription,
    NSMicrophoneUsageDescription (for trip recording)

EAS Build configuration (eas.json):
  - development profile (Expo Go compatible)
  - preview profile (internal TestFlight/APK)
  - production profile (App Store / Play Store)

App Store assets checklist (APPSTORE.md):
  - App icon specs (1024x1024 no alpha)
  - Screenshot sizes required per device
  - App description (provide compelling draft)
  - Keywords list
  - Privacy policy URL requirement
  - App category: Travel

TestFlight setup instructions (TESTFLIGHT.md):
  - How to create Apple Distribution certificate
  - How to run: eas build --platform ios --profile preview
  - How to submit to TestFlight: eas submit --platform ios
  - Internal tester instructions

Android APK testing (ANDROID_TEST.md):
  - How to run: eas build --platform android --profile preview
  - How to install APK on test device
  - ADB sideloading instructions

Supabase production checklist (PRODUCTION.md):
  - Switch to live Stripe keys
  - Configure Stripe webhook endpoint URL
  - Enable Supabase email confirmations
  - Set up Supabase pg_cron for scheduled rides
  - Configure RLS policies final review
  - Enable Supabase Point-In-Time Recovery
  - Set up database backups

Deliver all polish items, social login, scheduled rides, promo wiring, and all
documentation files. The app should be production-ready after this phase.
```

---

## 📎 CROSS-PHASE CONSTANTS
*(Reference these in every prompt if the AI loses context)*

| Item | Value |
|------|-------|
| App name | Lets Go |
| Bundle ID | com.letsgo.app |
| Market | Australia |
| Currency | AUD |
| Emergency number | 000 (AU) |
| Maps | Google Maps SDK |
| Payments | Stripe (AUD) |
| Backend | Supabase |
| Framework | React Native / Expo SDK 54 |
| Admin | React + Vite |
| Primary colour | #00D4AA |
| Background | #0A0E1A |
| Design vibe | Premium dark mode, Revolut meets Uber |
| Wait time grace | 2 minutes free, then billed per minute |
| Driver commission | Platform takes X% (configurable in fare_config) |
| Cancellation fee | After driver accepted + 2 min, configurable per ride type |
| Surge cap | Max 3.0x (admin configurable) |
| Driver payout | Stripe Connect Express, manual trigger + auto weekly |
| Test bank (AU) | BSB: 110-000, Account: 000123456 |

---

*End of Lets Go — Master AI Prompt Document*
*10 Phases | 3 User Types | Production-Ready*
