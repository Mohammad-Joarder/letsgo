-- ============================================================
-- Let's Go — Initial Schema Migration
-- 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE driver_status AS ENUM ('online', 'offline', 'on_trip');
CREATE TYPE driver_approval_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'suspended');
CREATE TYPE trip_status AS ENUM ('searching', 'driver_accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled', 'no_driver_found');
CREATE TYPE ride_type AS ENUM ('economy', 'comfort', 'premium', 'xl');
CREATE TYPE payment_status AS ENUM ('pending', 'authorised', 'captured', 'refunded', 'failed');
CREATE TYPE payment_method_type AS ENUM ('card', 'wallet', 'cash');
CREATE TYPE vehicle_category AS ENUM ('sedan', 'suv', 'van', 'luxury');
CREATE TYPE cancellation_reason AS ENUM ('rider_cancelled', 'driver_cancelled', 'no_show', 'app_issue');
CREATE TYPE document_type AS ENUM ('license_front', 'license_back', 'vehicle_registration', 'insurance', 'profile_photo', 'vehicle_photo');
CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

-- ============================================================
-- TABLE: profiles
-- ============================================================

CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role              user_role NOT NULL DEFAULT 'rider',
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  avatar_url        TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  expo_push_token   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: riders
-- ============================================================

CREATE TABLE riders (
  id                        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rating                    NUMERIC(3,2) NOT NULL DEFAULT 5.0 CHECK (rating >= 1 AND rating <= 5),
  total_trips               INT NOT NULL DEFAULT 0,
  preferred_payment_method  payment_method_type DEFAULT 'card',
  home_address              TEXT,
  work_address              TEXT,
  wallet_balance            NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_verified_id            BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: drivers
-- ============================================================

CREATE TABLE drivers (
  id                          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rating                      NUMERIC(3,2) NOT NULL DEFAULT 5.0 CHECK (rating >= 1 AND rating <= 5),
  total_trips                 INT NOT NULL DEFAULT 0,
  total_earnings              NUMERIC(12,2) NOT NULL DEFAULT 0,
  approval_status             driver_approval_status NOT NULL DEFAULT 'pending',
  current_status              driver_status NOT NULL DEFAULT 'offline',
  current_location            GEOMETRY(Point, 4326),
  current_location_updated_at TIMESTAMPTZ,
  stripe_connect_account_id   TEXT,
  stripe_connect_onboarded    BOOLEAN NOT NULL DEFAULT false,
  license_number              TEXT,
  license_expiry              DATE,
  bank_bsb                    TEXT,
  bank_account_number         TEXT,
  background_check_passed     BOOLEAN NOT NULL DEFAULT false,
  is_online                   BOOLEAN NOT NULL DEFAULT false,
  min_rider_rating            NUMERIC(3,2),
  tier                        TEXT NOT NULL DEFAULT 'standard',
  tier_trips_this_period      INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index on driver location
CREATE INDEX idx_drivers_location ON drivers USING GIST (current_location);

-- ============================================================
-- TABLE: vehicles
-- ============================================================

CREATE TABLE vehicles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id           UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  make                TEXT NOT NULL,
  model               TEXT NOT NULL,
  color               TEXT NOT NULL,
  year                INT NOT NULL,
  plate_number        TEXT NOT NULL,
  category            vehicle_category NOT NULL,
  ride_type           ride_type NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_approved         BOOLEAN NOT NULL DEFAULT false,
  seat_count          INT NOT NULL DEFAULT 4,
  registration_expiry DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: driver_documents
-- ============================================================

CREATE TABLE driver_documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id        UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type    document_type NOT NULL,
  storage_path     TEXT NOT NULL,
  is_verified      BOOLEAN NOT NULL DEFAULT false,
  verified_at      TIMESTAMPTZ,
  verified_by      UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, document_type)
);

-- ============================================================
-- TABLE: trips
-- ============================================================

CREATE TABLE trips (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id              UUID NOT NULL REFERENCES riders(id),
  driver_id             UUID REFERENCES drivers(id),
  vehicle_id            UUID REFERENCES vehicles(id),
  ride_type             ride_type NOT NULL,
  status                trip_status NOT NULL DEFAULT 'searching',
  pickup_address        TEXT NOT NULL,
  dropoff_address       TEXT NOT NULL,
  pickup_lat            NUMERIC(10,7) NOT NULL,
  pickup_lng            NUMERIC(10,7) NOT NULL,
  dropoff_lat           NUMERIC(10,7) NOT NULL,
  dropoff_lng           NUMERIC(10,7) NOT NULL,
  estimated_distance_km NUMERIC(8,2),
  estimated_duration_min INT,
  estimated_fare        NUMERIC(10,2),
  final_fare            NUMERIC(10,2),
  surge_multiplier      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  base_fare             NUMERIC(10,2) NOT NULL DEFAULT 0,
  distance_fare         NUMERIC(10,2) NOT NULL DEFAULT 0,
  time_fare             NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  scheduled_for         TIMESTAMPTZ,
  pickup_pin            CHAR(4),
  rider_rating          NUMERIC(3,2),
  driver_rating         NUMERIC(3,2),
  rider_tip             NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status        payment_status NOT NULL DEFAULT 'pending',
  payment_method        payment_method_type NOT NULL DEFAULT 'card',
  stripe_payment_intent_id TEXT,
  cancellation_reason   cancellation_reason,
  cancelled_by          UUID REFERENCES profiles(id),
  cancelled_at          TIMESTAMPTZ,
  driver_arrived_at     TIMESTAMPTZ,
  trip_started_at       TIMESTAMPTZ,
  trip_completed_at     TIMESTAMPTZ,
  notes                 TEXT,
  sos_triggered         BOOLEAN NOT NULL DEFAULT false,
  sos_at                TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_rider_id ON trips(rider_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);

-- ============================================================
-- TABLE: trip_locations
-- ============================================================

CREATE TABLE trip_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat         NUMERIC(10,7) NOT NULL,
  lng         NUMERIC(10,7) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_locations_trip_id ON trip_locations(trip_id);

-- ============================================================
-- TABLE: fare_config
-- ============================================================

CREATE TABLE fare_config (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_type           ride_type NOT NULL UNIQUE,
  base_fare           NUMERIC(8,2) NOT NULL,
  per_km_rate         NUMERIC(6,2) NOT NULL,
  per_min_rate        NUMERIC(6,2) NOT NULL,
  minimum_fare        NUMERIC(8,2) NOT NULL,
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
  cancellation_fee    NUMERIC(8,2) NOT NULL DEFAULT 5,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default fare config (AUD pricing)
INSERT INTO fare_config (ride_type, base_fare, per_km_rate, per_min_rate, minimum_fare, platform_fee_percent, cancellation_fee) VALUES
  ('economy', 3.50, 1.45, 0.35, 8.00, 15, 5.00),
  ('comfort',  4.50, 1.75, 0.45, 10.00, 15, 5.00),
  ('premium',  6.00, 2.50, 0.60, 15.00, 15, 7.50),
  ('xl',       5.50, 2.00, 0.50, 12.00, 15, 6.00);

-- ============================================================
-- TABLE: surge_zones
-- ============================================================

CREATE TABLE surge_zones (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  polygon    JSONB NOT NULL,
  multiplier NUMERIC(4,2) NOT NULL CHECK (multiplier >= 1.0 AND multiplier <= 3.0),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: promotions
-- ============================================================

CREATE TABLE promotions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           TEXT NOT NULL UNIQUE,
  discount_type  discount_type NOT NULL,
  discount_value NUMERIC(8,2) NOT NULL,
  min_fare       NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_discount   NUMERIC(8,2),
  valid_from     TIMESTAMPTZ NOT NULL,
  valid_until    TIMESTAMPTZ NOT NULL,
  max_uses       INT,
  uses_count     INT NOT NULL DEFAULT 0,
  per_user_limit INT NOT NULL DEFAULT 1,
  ride_types     ride_type[],
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: rider_promotions
-- ============================================================

CREATE TABLE rider_promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id     UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  trip_id      UUID REFERENCES trips(id),
  used_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: ratings
-- ============================================================

CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  to_user_id  UUID NOT NULL REFERENCES profiles(id),
  rating      NUMERIC(3,2) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  tags        TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, from_user_id)
);

-- ============================================================
-- TABLE: support_tickets
-- ============================================================

CREATE TABLE support_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  trip_id     UUID REFERENCES trips(id),
  category    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  status      ticket_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'system',
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- TABLE: driver_earnings_summary
-- ============================================================

CREATE TABLE driver_earnings_summary (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id         UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  total_trips       INT NOT NULL DEFAULT 0,
  total_gross       NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_earnings      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tips_total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  stripe_payout_id  TEXT,
  payout_status     payout_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, week_start)
);

-- ============================================================
-- TABLE: trip_messages (Phase 9, created now for schema completeness)
-- ============================================================

CREATE TABLE trip_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id),
  body       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read    BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_riders_updated_at BEFORE UPDATE ON riders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_driver_documents_updated_at BEFORE UPDATE ON driver_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fare_config_updated_at BEFORE UPDATE ON fare_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_surge_zones_updated_at BEFORE UPDATE ON surge_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_driver_earnings_summary_updated_at BEFORE UPDATE ON driver_earnings_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile after auth signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'rider')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fare_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE surge_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_earnings_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: is current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RIDERS
CREATE POLICY "riders_select_own" ON riders FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "riders_update_own" ON riders FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "riders_insert_own" ON riders FOR INSERT WITH CHECK (auth.uid() = id);

-- DRIVERS
CREATE POLICY "drivers_select_own" ON drivers FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "drivers_update_own" ON drivers FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "drivers_insert_own" ON drivers FOR INSERT WITH CHECK (auth.uid() = id);
-- Riders can see online drivers (for map)
CREATE POLICY "drivers_select_online" ON drivers FOR SELECT USING (is_online = true AND approval_status = 'approved');

-- VEHICLES
CREATE POLICY "vehicles_select_own" ON vehicles FOR SELECT USING (
  driver_id = auth.uid() OR is_admin() OR
  EXISTS (SELECT 1 FROM trips WHERE trips.vehicle_id = vehicles.id AND trips.rider_id = auth.uid())
);
CREATE POLICY "vehicles_insert_own" ON vehicles FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "vehicles_update_own" ON vehicles FOR UPDATE USING (driver_id = auth.uid() OR is_admin());

-- DRIVER DOCUMENTS
CREATE POLICY "driver_docs_select" ON driver_documents FOR SELECT USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "driver_docs_insert" ON driver_documents FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "driver_docs_update" ON driver_documents FOR UPDATE USING (driver_id = auth.uid() OR is_admin());

-- TRIPS
CREATE POLICY "trips_select" ON trips FOR SELECT USING (
  rider_id = auth.uid() OR driver_id = auth.uid() OR is_admin()
);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (rider_id = auth.uid());
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (
  rider_id = auth.uid() OR driver_id = auth.uid() OR is_admin()
);

-- TRIP LOCATIONS
CREATE POLICY "trip_locations_select" ON trip_locations FOR SELECT USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND (trips.rider_id = auth.uid() OR trips.driver_id = auth.uid())) OR is_admin()
);
CREATE POLICY "trip_locations_insert" ON trip_locations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.driver_id = auth.uid())
);

-- FARE CONFIG
CREATE POLICY "fare_config_select" ON fare_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fare_config_write" ON fare_config FOR ALL USING (is_admin());

-- SURGE ZONES
CREATE POLICY "surge_zones_select" ON surge_zones FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "surge_zones_write" ON surge_zones FOR ALL USING (is_admin());

-- PROMOTIONS
CREATE POLICY "promotions_select" ON promotions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "promotions_write" ON promotions FOR ALL USING (is_admin());

-- RIDER PROMOTIONS
CREATE POLICY "rider_promotions_select" ON rider_promotions FOR SELECT USING (rider_id = auth.uid() OR is_admin());
CREATE POLICY "rider_promotions_insert" ON rider_promotions FOR INSERT WITH CHECK (rider_id = auth.uid());

-- RATINGS
CREATE POLICY "ratings_select" ON ratings FOR SELECT USING (
  from_user_id = auth.uid() OR to_user_id = auth.uid() OR is_admin()
);
CREATE POLICY "ratings_insert" ON ratings FOR INSERT WITH CHECK (from_user_id = auth.uid());

-- SUPPORT TICKETS
CREATE POLICY "tickets_select" ON support_tickets FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "tickets_insert" ON support_tickets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_update" ON support_tickets FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- NOTIFICATIONS
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (is_admin() OR user_id = auth.uid());

-- DRIVER EARNINGS SUMMARY
CREATE POLICY "earnings_select" ON driver_earnings_summary FOR SELECT USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "earnings_write" ON driver_earnings_summary FOR ALL USING (is_admin());

-- TRIP MESSAGES
CREATE POLICY "trip_messages_select" ON trip_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND (trips.rider_id = auth.uid() OR trips.driver_id = auth.uid()))
);
CREATE POLICY "trip_messages_insert" ON trip_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND (trips.rider_id = auth.uid() OR trips.driver_id = auth.uid()))
);
