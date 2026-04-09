import type {
  CreateTripResponse,
  FareEstimateResponse,
  RideType,
  SearchNearbyResponse,
} from "@/lib/bookingTypes";
import { getUserAccessTokenForEdge, refreshUserAccessTokenForEdge } from "@/lib/accessTokenForEdge";
import { postEdgeFunctionJson, postEdgeFunctionWithUserJwt } from "@/lib/edgeFunctionFetch";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

const CREATE_TRIP_TIMEOUT_MS = 45_000;

async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
  opts?: Parameters<typeof invokeEdgeFunction>[2]
): Promise<T> {
  return invokeEdgeFunction<T>(name, body, opts);
}

export async function getFareEstimate(params: {
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}): Promise<FareEstimateResponse> {
  // Raw fetch + AbortController: avoids supabase-js invoke hanging on some RN builds.
  return postEdgeFunctionJson<FareEstimateResponse>(
    "get-fare-estimate",
    params as unknown as Record<string, unknown>,
    35_000
  );
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
  /** Required for card bookings after Stripe authorize (Phase 5). */
  stripe_payment_intent_id?: string;
};

export async function createPaymentIntent(body: {
  amount_cents: number;
  trip_id?: string;
  payment_method_id?: string;
}): Promise<{
  ok: boolean;
  client_secret?: string;
  payment_intent_id?: string;
  error?: string;
}> {
  return invoke("create-payment-intent", body as unknown as Record<string, unknown>);
}

export type RiderPaymentMethodRow = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

export async function riderStripePaymentMethods(body: {
  action: "list" | "attach" | "detach" | "set_default";
  payment_method_id?: string;
}): Promise<{
  ok: boolean;
  payment_methods?: RiderPaymentMethodRow[];
  default_payment_method_id?: string | null;
  error?: string;
}> {
  return invoke("rider-stripe-payment-methods", body as unknown as Record<string, unknown>);
}

export async function chargeRiderTip(body: {
  trip_id: string;
  amount_cents: number;
  payment_method_id?: string;
}): Promise<{
  ok: boolean;
  payment_intent_id?: string;
  requires_action?: boolean;
  client_secret?: string;
  error?: string;
}> {
  return invoke("charge-rider-tip", body as unknown as Record<string, unknown>);
}

export async function riderCancelTrip(tripId: string): Promise<{
  ok: boolean;
  fee_aud?: number;
  free_cancellation?: boolean;
  error?: string;
}> {
  return invoke("rider-cancel-trip", { trip_id: tripId });
}

export async function createTrip(body: CreateTripPayload): Promise<CreateTripResponse> {
  const payload = body as unknown as Record<string, unknown>;
  let token: string;
  try {
    token = await getUserAccessTokenForEdge();
  } catch (e) {
    const m = e instanceof Error ? e.message : "Sign in required.";
    throw new Error(m === "Sign in required." ? "Sign in required to book a ride." : m);
  }

  try {
    return await postEdgeFunctionWithUserJwt<CreateTripResponse>(
      "create-trip",
      payload,
      token,
      CREATE_TRIP_TIMEOUT_MS
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const is401 =
      msg.includes("(401)") || /invalid jwt/i.test(msg) || /jwt expired/i.test(msg);
    if (!is401) throw e;

    const t2 = await refreshUserAccessTokenForEdge();
    return postEdgeFunctionWithUserJwt<CreateTripResponse>(
      "create-trip",
      payload,
      t2,
      CREATE_TRIP_TIMEOUT_MS
    );
  }
}
