import type {
  CreateTripResponse,
  FareEstimateResponse,
  RideType,
  SearchNearbyResponse,
} from "@/lib/bookingTypes";
import { supabase } from "@/lib/supabase";

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new Error(error.message ?? `Function ${name} failed`);
  }
  return data as T;
}

export async function getFareEstimate(params: {
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}): Promise<FareEstimateResponse> {
  return invoke<FareEstimateResponse>("get-fare-estimate", params as unknown as Record<string, unknown>);
}

export async function searchNearbyDrivers(params: {
  pickup_lat: number;
  pickup_lng: number;
  ride_type: RideType;
  radius_km?: number;
}): Promise<SearchNearbyResponse> {
  return invoke<SearchNearbyResponse>("search-nearby-drivers", params as unknown as Record<string, unknown>);
}

export type CreateTripPayload = {
  ride_type: RideType;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_distance_km?: number | null;
  estimated_duration_min?: number | null;
  estimated_fare?: number | null;
  surge_multiplier?: number;
  base_fare?: number | null;
  distance_fare?: number | null;
  time_fare?: number | null;
  platform_fee?: number | null;
  notes?: string | null;
  scheduled_for?: string | null;
  payment_method?: "card" | "wallet" | "cash";
};

export async function createTrip(body: CreateTripPayload): Promise<CreateTripResponse> {
  return invoke<CreateTripResponse>("create-trip", body as unknown as Record<string, unknown>);
}
