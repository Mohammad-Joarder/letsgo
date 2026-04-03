export type RideType = "economy" | "comfort" | "premium" | "xl";

export type FareEstimateOption = {
  ride_type: RideType;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  minimum_fare: number;
  subtotal_pre_minimum: number;
  fare_pre_surge: number;
  estimated_fare: number;
  platform_fee_percent: number;
  platform_fee: number;
  surge_multiplier: number;
};

export type FareEstimateResponse = {
  ok: boolean;
  error?: string;
  distance_km?: number;
  duration_min?: number;
  surge_active?: boolean;
  surge_multiplier?: number;
  options?: FareEstimateOption[];
};

export type NearbyDriver = {
  driver_id: string;
  distance_m: number;
  eta_min: number;
  current_lat: number;
  current_lng: number;
};

export type SearchNearbyResponse = {
  ok: boolean;
  error?: string;
  drivers?: NearbyDriver[];
  message?: string;
};

export type CreateTripResponse = {
  ok: boolean;
  error?: string;
  trip_id?: string;
  pickup_pin?: string;
  status?: string;
};

export type PlaceSuggestion = {
  id: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
};

export type ResolvedPlace = {
  /** Display line (e.g. formatted address) */
  description: string;
  lat: number;
  lng: number;
};
