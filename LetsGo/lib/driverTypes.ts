export type TripOfferPayload = {
  trip_id: string;
  ride_type: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_fare: number | null;
  estimated_distance_km: number | null;
  estimated_duration_min: number | null;
  platform_fee: number | null;
  estimated_net_earnings: number;
  rider_name: string;
  rider_rating: number;
  rider_verified?: boolean;
  offer_expires_at: string;
};
