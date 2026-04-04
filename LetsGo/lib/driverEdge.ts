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

export async function createPayout(): Promise<{
  ok: boolean;
  rows_queued?: number;
  total_net?: number;
  message?: string;
  error?: string;
}> {
  return invoke("create-payout", {});
}
