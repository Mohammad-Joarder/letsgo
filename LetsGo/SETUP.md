# Let's Go — Phase 1 Setup Guide

## Prerequisites
- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase CLI: `npm install -g supabase`
- Git installed

---

## Step 1 — Copy Project to Your Machine

Copy the entire `/LetsGo` folder to:
```
C:\Users\mohammad.joarder\Downloads\LetsGo\LetsGo
```

---

## Step 2 — Install Dependencies

```bash
cd C:\Users\mohammad.joarder\Downloads\LetsGo\LetsGo
npm install
```

---

## Step 3 — Run the Database Migration

1. Go to your Supabase project dashboard:
   https://supabase.com/dashboard/project/vbvlytmfnozsjldzgdcr

2. Navigate to **SQL Editor** (left sidebar)

3. Click **New Query**

4. Open the file `supabase/migrations/001_initial_schema.sql`
   and paste the ENTIRE contents into the SQL Editor

5. Click **Run** (or press Ctrl+Enter)

6. You should see "Success. No rows returned" — this means all tables,
   enums, RLS policies, and triggers were created successfully.

7. Verify in **Table Editor** — you should see all 16 tables listed.

---

## Step 4 — Enable PostGIS Extension

If PostGIS wasn't enabled by the migration:

1. Go to **Database → Extensions** in your Supabase dashboard
2. Search for "postgis"
3. Toggle it ON

---

## Step 5 — Configure Supabase Auth

1. Go to **Authentication → Providers**
2. Make sure **Email** provider is enabled
3. Under **Email**, set:
   - Enable email confirmations: ON (for production)
   - Disable email confirmations: ON (for development/testing)
   - Secure email change: ON

4. Go to **Authentication → URL Configuration**
5. Set Site URL: `letsgo://`
6. Add Redirect URLs:
   - `letsgo://`
   - `letsgo://reset-password`
   - `exp://localhost:8081` (for Expo Go testing)

---

## Step 6 — Create Supabase Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. Create the following buckets:

   | Bucket Name       | Public | Description               |
   |-------------------|--------|---------------------------|
   | driver-documents  | false  | Driver ID/vehicle docs    |
   | profile-photos    | true   | User avatar images        |
   | vehicle-photos    | false  | Vehicle images            |

3. For `driver-documents` bucket, add RLS policy:
   - Authenticated users can upload to their own folder
   - Only admins can read

---

## Step 7 — Deploy Edge Function Stubs

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref vbvlytmfnozsjldzgdcr

# Deploy all edge function stubs
supabase functions deploy get-fare-estimate
supabase functions deploy search-nearby-drivers
supabase functions deploy create-trip
supabase functions deploy assign-driver
supabase functions deploy update-driver-location
supabase functions deploy complete-trip
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy create-connect-account
supabase functions deploy create-payout
supabase functions deploy send-push-notification
```

Set the required secret (do NOT use SUPABASE_ prefix):
```bash
supabase secrets set SERVICE_ROLE_KEY=your_service_role_key_here
```

Find your service role key at:
Supabase Dashboard → Settings → API → service_role (secret)

---

## Step 8 — Run the App

```bash
# Start Expo development server
npx expo start

# Then press:
# a → open Android emulator
# i → open iOS simulator
# Scan QR code with Expo Go app on physical device
```

---

## Step 9 — Create Your First Admin User

1. Sign up normally in the app with your admin email
2. Go to Supabase Dashboard → Table Editor → profiles
3. Find your row and change `role` from `rider` to `admin`
4. Sign out and sign back in — you'll see the admin web screen

---

## Step 10 — Verify Everything Works

Test this flow end-to-end:
1. ✅ Open app → Welcome screen appears (dark, premium)
2. ✅ Tap "Create Account" → Sign up form
3. ✅ Submit form → OTP screen (check your email)
4. ✅ Enter OTP code → Role selection screen
5. ✅ Choose "I'm a Rider" → Rider home tab shell
6. ✅ Choose "I'm a Driver" → Driver pending screen
7. ✅ Sign in with existing account → correct role routing
8. ✅ Forgot password → email received

---

## Troubleshooting

**"Module not found" errors after npm install**
```bash
npx expo install --fix
```

**NativeWind styles not applying**
```bash
# Make sure tailwind.config.js content paths are correct
# Restart Metro bundler with cache clear:
npx expo start --clear
```

**Fonts not loading**
```bash
npm install @expo-google-fonts/sora @expo-google-fonts/inter
```

**Supabase connection errors**
- Double-check URL and anon key in `lib/constants.ts`
- Verify RLS policies allow the operation
- Check Supabase Dashboard → Logs → Edge Functions

**OTP email not arriving**
- Check spam folder
- Verify email provider is enabled in Supabase Auth settings
- For testing: disable email confirmation in Auth settings

---

## Project Keys Reference

| Key | Value |
|-----|-------|
| Supabase URL | https://vbvlytmfnozsjldzgdcr.supabase.co |
| Supabase Anon Key | eyJhbGci... (in lib/constants.ts) |
| Google Maps API Key | AIzaSyAFpB2... (in lib/constants.ts) |
| iOS Bundle ID | com.letsgo.app |
| Android Package | com.letsgo.app |
| Expo Scheme | letsgo:// |

---

## Next Phase

Once Phase 1 is working, proceed to Phase 2:
- Rider booking flow with real Google Maps
- Live map with nearby driver markers
- Fare estimation edge function
- Route polyline drawing

See `LetsGo_Master_Prompt.md` for the Phase 2 prompt.
