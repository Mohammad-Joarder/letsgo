import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  return invokeEdgeFunction<T>(name, body);
}

export async function assignDriver(body: {
  trip_id: string;
  action: "accept" | "reject";
}): Promise<{ ok: boolean; error?: string; status?: string }> {
  return invoke("assign-driver", body);
}

export async function updateDriverLocation(lat: number, lng: number): Promise<{ ok: boolean }> {
  return invoke("update-driver-location", { lat, lng });
}

export async function completeTrip(body: {
  trip_id: string;
  final_fare?: number;
}): Promise<{ ok: boolean; final_fare?: number; net_earnings?: number; error?: string }> {
  return invoke("complete-trip", body);
}

export async function createPayout(body?: {
  amount_cents?: number;
}): Promise<{
  ok: boolean;
  payout_id?: string;
  transfer_id?: string;
  estimated_arrival?: number | null;
  message?: string;
  error?: string;
}> {
  return invoke("create-payout", (body ?? {}) as Record<string, unknown>);
}

export async function createConnectAccount(body?: {
  driver_id?: string;
  /** Expo / dev-client deep link; Edge appends to HTTPS return URL so the browser can hand off to the app. */
  app_continue_url?: string;
}): Promise<{
  ok: boolean;
  account_id?: string;
  onboarding_url?: string;
  error?: string;
}> {
  return invoke("create-connect-account", (body ?? {}) as Record<string, unknown>);
}

/** Pulls Stripe Connect account state and updates `drivers.stripe_connect_onboarded` (same logic as webhook). */
export async function syncDriverStripeConnect(): Promise<{
  ok: boolean;
  stripe_connect_onboarded?: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  message?: string;
  error?: string;
}> {
  return invoke("sync-driver-stripe-connect", {});
}
