-- ============================================================================
-- Lets Go — Initial schema (Phase 1)
-- PostGIS + full enums, tables, timestamps, RLS on every table
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- -----------------------------------------------------------------------------
-- ENUM types
-- -----------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('rider', 'driver', 'admin');

CREATE TYPE public.driver_status AS ENUM ('online', 'offline', 'on_trip');

CREATE TYPE public.driver_approval_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended'
);

CREATE TYPE public.trip_status AS ENUM (
  'searching',
  'driver_accepted',
  'driver_arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_driver_found'
);

CREATE TYPE public.ride_type AS ENUM ('economy', 'comfort', 'premium', 'xl');

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'authorised',
  'captured',
  'refunded',
  'failed'
);

CREATE TYPE public.payment_method_type AS ENUM ('card', 'wallet', 'cash');

CREATE TYPE public.vehicle_category AS ENUM ('sedan', 'suv', 'van', 'luxury');

CREATE TYPE public.cancellation_reason AS ENUM (
  'rider_cancelled',
  'driver_cancelled',
  'no_show',
  'app_issue'
);

CREATE TYPE public.document_type AS ENUM (
  'license_front',
  'license_back',
  'vehicle_registration',
  'insurance',
  'profile_photo',
  'vehicle_photo'
);

CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed');

CREATE TYPE public.support_ticket_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE public.payout_status AS ENUM (
  'pending',
  'processing',
  'paid',
  'failed'
);

-- -----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'rider'::public.user_role,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx ON public.profiles (role);
CREATE INDEX profiles_email_idx ON public.profiles (email);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helper: admin check (must run after profiles exists; SECURITY DEFINER avoids RLS recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::public.user_role
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. riders
-- -----------------------------------------------------------------------------
CREATE TABLE public.riders (
  id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating numeric(3, 2) NOT NULL DEFAULT 5.0
    CHECK (rating >= 1 AND rating <= 5),
  total_trips integer NOT NULL DEFAULT 0,
  preferred_payment_method public.payment_method_type,
  home_address text,
  work_address text,
  wallet_balance numeric(12, 2) NOT NULL DEFAULT 0,
  is_verified_id boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER riders_set_updated_at
BEFORE UPDATE ON public.riders
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. drivers
-- -----------------------------------------------------------------------------
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating numeric(3, 2) NOT NULL DEFAULT 5.0
    CHECK (rating >= 1 AND rating <= 5),
  total_trips integer NOT NULL DEFAULT 0,
  total_earnings numeric(14, 2) NOT NULL DEFAULT 0,
  approval_status public.driver_approval_status NOT NULL DEFAULT 'pending'::public.driver_approval_status,
  current_status public.driver_status NOT NULL DEFAULT 'offline'::public.driver_status,
  current_location geography (Point, 4326),
  current_location_updated_at timestamptz,
  stripe_connect_account_id text,
  stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  license_number text,
  license_expiry date,
  bank_bsb text,
  bank_account_number text,
  background_check_passed boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX drivers_approval_idx ON public.drivers (approval_status);
CREATE INDEX drivers_online_idx ON public.drivers (is_online, current_status);
CREATE INDEX drivers_location_gix ON public.drivers USING GIST (current_location);

CREATE TRIGGER drivers_set_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. vehicles
-- -----------------------------------------------------------------------------
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  color text NOT NULL,
  year integer NOT NULL,
  plate_number text NOT NULL,
  category public.vehicle_category NOT NULL,
  ride_type public.ride_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_approved boolean NOT NULL DEFAULT false,
  seat_count integer NOT NULL DEFAULT 4,
  registration_expiry date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicles_driver_id_idx ON public.vehicles (driver_id);

CREATE TRIGGER vehicles_set_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. driver_documents
-- -----------------------------------------------------------------------------
CREATE TABLE public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  storage_path text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles (id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX driver_documents_driver_idx ON public.driver_documents (driver_id);

CREATE TRIGGER driver_documents_set_updated_at
BEFORE UPDATE ON public.driver_documents
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. trips
-- -----------------------------------------------------------------------------
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  rider_id uuid NOT NULL REFERENCES public.riders (id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.drivers (id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  ride_type public.ride_type NOT NULL,
  status public.trip_status NOT NULL DEFAULT 'searching'::public.trip_status,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  dropoff_lat numeric NOT NULL,
  dropoff_lng numeric NOT NULL,
  estimated_distance_km numeric,
  estimated_duration_min integer,
  estimated_fare numeric(12, 2),
  final_fare numeric(12, 2),
  surge_multiplier numeric(6, 2) NOT NULL DEFAULT 1.0,
  base_fare numeric(12, 2),
  distance_fare numeric(12, 2),
  time_fare numeric(12, 2),
  platform_fee numeric(12, 2),
  scheduled_for timestamptz,
  pickup_pin text,
  rider_rating numeric(3, 2),
  driver_rating numeric(3, 2),
  rider_tip numeric(12, 2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'pending'::public.payment_status,
  payment_method public.payment_method_type,
  stripe_payment_intent_id text,
  cancellation_reason public.cancellation_reason,
  cancelled_by uuid REFERENCES public.profiles (id),
  cancelled_at timestamptz,
  driver_arrived_at timestamptz,
  trip_started_at timestamptz,
  trip_completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_pickup_pin_len CHECK (
    pickup_pin IS NULL OR char_length(pickup_pin) = 4
  )
);

CREATE INDEX trips_rider_idx ON public.trips (rider_id);
CREATE INDEX trips_driver_idx ON public.trips (driver_id);
CREATE INDEX trips_status_idx ON public.trips (status);
CREATE INDEX trips_created_idx ON public.trips (created_at DESC);

CREATE TRIGGER trips_set_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. trip_locations
-- -----------------------------------------------------------------------------
CREATE TABLE public.trip_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trip_locations_trip_recorded_idx ON public.trip_locations (trip_id, recorded_at DESC);

CREATE TRIGGER trip_locations_set_updated_at
BEFORE UPDATE ON public.trip_locations
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. fare_config
-- -----------------------------------------------------------------------------
CREATE TABLE public.fare_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  ride_type public.ride_type NOT NULL UNIQUE,
  base_fare numeric(12, 2) NOT NULL,
  per_km_rate numeric(12, 4) NOT NULL,
  per_min_rate numeric(12, 4) NOT NULL,
  minimum_fare numeric(12, 2) NOT NULL,
  platform_fee_percent numeric(6, 4) NOT NULL,
  cancellation_fee numeric(12, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER fare_config_set_updated_at
BEFORE UPDATE ON public.fare_config
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. surge_zones
-- -----------------------------------------------------------------------------
CREATE TABLE public.surge_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  polygon jsonb NOT NULL,
  multiplier numeric(6, 2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER surge_zones_set_updated_at
BEFORE UPDATE ON public.surge_zones
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. promotions
-- -----------------------------------------------------------------------------
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  code text NOT NULL UNIQUE,
  discount_type public.discount_type NOT NULL,
  discount_value numeric(12, 2) NOT NULL,
  min_fare numeric(12, 2) NOT NULL DEFAULT 0,
  max_discount numeric(12, 2),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  max_uses integer NOT NULL,
  uses_count integer NOT NULL DEFAULT 0,
  per_user_limit integer NOT NULL DEFAULT 1,
  ride_types public.ride_type[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER promotions_set_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. rider_promotions
-- -----------------------------------------------------------------------------
CREATE TABLE public.rider_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  rider_id uuid NOT NULL REFERENCES public.riders (id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rider_promotions_rider_idx ON public.rider_promotions (rider_id);
CREATE INDEX rider_promotions_promo_idx ON public.rider_promotions (promotion_id);

CREATE TRIGGER rider_promotions_set_updated_at
BEFORE UPDATE ON public.rider_promotions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 12. ratings
-- -----------------------------------------------------------------------------
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating numeric(3, 2) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_from_to_distinct CHECK (from_user_id <> to_user_id)
);

CREATE INDEX ratings_trip_idx ON public.ratings (trip_id);
CREATE INDEX ratings_to_user_idx ON public.ratings (to_user_id);

CREATE TRIGGER ratings_set_updated_at
BEFORE UPDATE ON public.ratings
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 13. support_tickets
-- -----------------------------------------------------------------------------
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open'::public.support_ticket_status,
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_user_idx ON public.support_tickets (user_id);
CREATE INDEX support_tickets_status_idx ON public.support_tickets (status);

CREATE TRIGGER support_tickets_set_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 14. notifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications (user_id, is_read);

CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 15. driver_earnings_summary
-- -----------------------------------------------------------------------------
CREATE TABLE public.driver_earnings_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  total_trips integer NOT NULL DEFAULT 0,
  total_gross numeric(14, 2) NOT NULL DEFAULT 0,
  platform_fee_total numeric(14, 2) NOT NULL DEFAULT 0,
  net_earnings numeric(14, 2) NOT NULL DEFAULT 0,
  tips_total numeric(14, 2) NOT NULL DEFAULT 0,
  stripe_payout_id text,
  payout_status public.payout_status NOT NULL DEFAULT 'pending'::public.payout_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, week_start)
);

CREATE INDEX driver_earnings_summary_driver_idx ON public.driver_earnings_summary (driver_id);

CREATE TRIGGER driver_earnings_summary_set_updated_at
BEFORE UPDATE ON public.driver_earnings_summary
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security — enable on all tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_earnings_summary ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS: profiles
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles FOR SELECT
  USING (id = auth.uid () OR public.is_admin ());

CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid ());

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles FOR UPDATE
  USING (id = auth.uid () OR public.is_admin ())
  WITH CHECK (id = auth.uid () OR public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: riders
-- -----------------------------------------------------------------------------
CREATE POLICY riders_select_own_or_admin
  ON public.riders FOR SELECT
  USING (id = auth.uid () OR public.is_admin ());

CREATE POLICY riders_insert_own
  ON public.riders FOR INSERT
  WITH CHECK (id = auth.uid ());

CREATE POLICY riders_update_own_or_admin
  ON public.riders FOR UPDATE
  USING (id = auth.uid () OR public.is_admin ())
  WITH CHECK (id = auth.uid () OR public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: drivers
-- -----------------------------------------------------------------------------
CREATE POLICY drivers_select_own_or_admin
  ON public.drivers FOR SELECT
  USING (id = auth.uid () OR public.is_admin ());

CREATE POLICY drivers_insert_own
  ON public.drivers FOR INSERT
  WITH CHECK (id = auth.uid ());

CREATE POLICY drivers_update_own_or_admin
  ON public.drivers FOR UPDATE
  USING (id = auth.uid () OR public.is_admin ())
  WITH CHECK (id = auth.uid () OR public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: vehicles — driver manages own; admin full
-- -----------------------------------------------------------------------------
CREATE POLICY vehicles_select_driver_or_admin
  ON public.vehicles FOR SELECT
  USING (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY vehicles_insert_driver_or_admin
  ON public.vehicles FOR INSERT
  WITH CHECK (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY vehicles_update_driver_or_admin
  ON public.vehicles FOR UPDATE
  USING (driver_id = auth.uid () OR public.is_admin ())
  WITH CHECK (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY vehicles_delete_driver_or_admin
  ON public.vehicles FOR DELETE
  USING (driver_id = auth.uid () OR public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: driver_documents — driver own; admin read/update for verification
-- -----------------------------------------------------------------------------
CREATE POLICY driver_documents_select_driver_or_admin
  ON public.driver_documents FOR SELECT
  USING (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY driver_documents_insert_driver_or_admin
  ON public.driver_documents FOR INSERT
  WITH CHECK (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY driver_documents_update_driver_or_admin
  ON public.driver_documents FOR UPDATE
  USING (driver_id = auth.uid () OR public.is_admin ())
  WITH CHECK (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY driver_documents_delete_driver_or_admin
  ON public.driver_documents FOR DELETE
  USING (driver_id = auth.uid () OR public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: trips — rider / assigned driver / admin
-- -----------------------------------------------------------------------------
CREATE POLICY trips_select_participants_or_admin
  ON public.trips FOR SELECT
  USING (
    rider_id = auth.uid ()
    OR driver_id = auth.uid ()
    OR public.is_admin ()
  );

CREATE POLICY trips_insert_rider
  ON public.trips FOR INSERT
  WITH CHECK (
    rider_id = auth.uid ()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid () AND p.role = 'rider'::public.user_role
    )
  );

CREATE POLICY trips_update_participants_or_admin
  ON public.trips FOR UPDATE
  USING (
    rider_id = auth.uid ()
    OR driver_id = auth.uid ()
    OR public.is_admin ()
  )
  WITH CHECK (
    rider_id = auth.uid ()
    OR driver_id = auth.uid ()
    OR public.is_admin ()
  );

CREATE POLICY trips_delete_admin_only
  ON public.trips FOR DELETE
  USING (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: trip_locations — rider/driver on trip or admin
-- -----------------------------------------------------------------------------
CREATE POLICY trip_locations_select_trip_participant_or_admin
  ON public.trip_locations FOR SELECT
  USING (
    public.is_admin ()
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_locations.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid ())
    )
  );

CREATE POLICY trip_locations_insert_trip_participant_or_admin
  ON public.trip_locations FOR INSERT
  WITH CHECK (
    public.is_admin ()
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_locations.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid ())
    )
  );

CREATE POLICY trip_locations_update_trip_participant_or_admin
  ON public.trip_locations FOR UPDATE
  USING (
    public.is_admin ()
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_locations.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid ())
    )
  )
  WITH CHECK (
    public.is_admin ()
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_locations.trip_id
        AND (t.rider_id = auth.uid () OR t.driver_id = auth.uid ())
    )
  );

CREATE POLICY trip_locations_delete_admin_only
  ON public.trip_locations FOR DELETE
  USING (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: fare_config — read authenticated; write admin
-- -----------------------------------------------------------------------------
CREATE POLICY fare_config_select_authenticated
  ON public.fare_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY fare_config_all_admin
  ON public.fare_config FOR ALL
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: surge_zones — read authenticated; write admin
-- -----------------------------------------------------------------------------
CREATE POLICY surge_zones_select_authenticated
  ON public.surge_zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY surge_zones_all_admin
  ON public.surge_zones FOR ALL
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: promotions — read authenticated; write admin
-- -----------------------------------------------------------------------------
CREATE POLICY promotions_select_authenticated
  ON public.promotions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY promotions_all_admin
  ON public.promotions FOR ALL
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: rider_promotions — rider sees own; admin all; insert own rider_id
-- -----------------------------------------------------------------------------
CREATE POLICY rider_promotions_select_own_or_admin
  ON public.rider_promotions FOR SELECT
  USING (rider_id = auth.uid () OR public.is_admin ());

CREATE POLICY rider_promotions_insert_own_or_admin
  ON public.rider_promotions FOR INSERT
  WITH CHECK (rider_id = auth.uid () OR public.is_admin ());

CREATE POLICY rider_promotions_update_admin_only
  ON public.rider_promotions FOR UPDATE
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

CREATE POLICY rider_promotions_delete_admin_only
  ON public.rider_promotions FOR DELETE
  USING (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: ratings — involved parties read; admin all; insert as from_user
-- -----------------------------------------------------------------------------
CREATE POLICY ratings_select_involved_or_admin
  ON public.ratings FOR SELECT
  USING (
    from_user_id = auth.uid ()
    OR to_user_id = auth.uid ()
    OR public.is_admin ()
  );

CREATE POLICY ratings_insert_from_self
  ON public.ratings FOR INSERT
  WITH CHECK (from_user_id = auth.uid ());

CREATE POLICY ratings_update_admin_only
  ON public.ratings FOR UPDATE
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

CREATE POLICY ratings_delete_admin_only
  ON public.ratings FOR DELETE
  USING (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: support_tickets — user own; admin all
-- -----------------------------------------------------------------------------
CREATE POLICY support_tickets_select_own_or_admin
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid () OR public.is_admin ());

CREATE POLICY support_tickets_insert_own
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid () OR public.is_admin ());

CREATE POLICY support_tickets_update_own_or_admin
  ON public.support_tickets FOR UPDATE
  USING (user_id = auth.uid () OR public.is_admin ())
  WITH CHECK (user_id = auth.uid () OR public.is_admin ());

CREATE POLICY support_tickets_delete_admin_only
  ON public.support_tickets FOR DELETE
  USING (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: notifications — user read/update own (no client insert; service role bypasses RLS)
-- -----------------------------------------------------------------------------
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid () OR public.is_admin ());

CREATE POLICY notifications_update_own_or_admin
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid () OR public.is_admin ())
  WITH CHECK (user_id = auth.uid () OR public.is_admin ());

CREATE POLICY notifications_insert_admin_only
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RLS: driver_earnings_summary — driver reads own; admin all; mutations admin/service
-- -----------------------------------------------------------------------------
CREATE POLICY driver_earnings_summary_select_own_or_admin
  ON public.driver_earnings_summary FOR SELECT
  USING (driver_id = auth.uid () OR public.is_admin ());

CREATE POLICY driver_earnings_summary_all_admin
  ON public.driver_earnings_summary FOR ALL
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

-- ============================================================================
-- End of migration
-- ============================================================================
