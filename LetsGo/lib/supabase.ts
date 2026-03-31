import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ─── Types ────────────────────────────────────────────────────

export type UserRole = "rider" | "driver" | "admin";
export type DriverStatus = "online" | "offline" | "on_trip";
export type DriverApprovalStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";
export type TripStatus =
  | "searching"
  | "driver_accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_driver_found";
export type RideType = "economy" | "comfort" | "premium" | "xl";
export type PaymentStatus =
  | "pending"
  | "authorised"
  | "captured"
  | "refunded"
  | "failed";
export type PaymentMethodType = "card" | "wallet" | "cash";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  stripe_customer_id: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  rating: number;
  total_trips: number;
  preferred_payment_method: PaymentMethodType;
  home_address: string | null;
  work_address: string | null;
  wallet_balance: number;
  is_verified_id: boolean;
}

export interface Driver {
  id: string;
  rating: number;
  total_trips: number;
  total_earnings: number;
  approval_status: DriverApprovalStatus;
  current_status: DriverStatus;
  current_location: { coordinates: [number, number] } | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  license_number: string | null;
  license_expiry: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  background_check_passed: boolean;
  is_online: boolean;
  min_rider_rating: number | null;
  tier: string;
  tier_trips_this_period: number;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  make: string;
  model: string;
  color: string;
  year: number;
  plate_number: string;
  category: string;
  ride_type: RideType;
  is_active: boolean;
  is_approved: boolean;
  seat_count: number;
  registration_expiry: string | null;
}

export interface Trip {
  id: string;
  rider_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  ride_type: RideType;
  status: TripStatus;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_distance_km: number | null;
  estimated_duration_min: number | null;
  estimated_fare: number | null;
  final_fare: number | null;
  surge_multiplier: number;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  platform_fee: number;
  scheduled_for: string | null;
  pickup_pin: string | null;
  rider_rating: number | null;
  driver_rating: number | null;
  rider_tip: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethodType;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  sos_triggered: boolean;
  created_at: string;
  updated_at: string;
}
