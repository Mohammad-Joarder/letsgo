import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendExpoPushMessages } from "./expo_push.ts";

/** Out-of-band alert when a driver may miss Realtime (background, WS, or RLS on broadcast). */
export async function notifyDriverTripOfferPush(
  supabaseUrl: string,
  serviceKey: string,
  driverId: string,
  tripId: string,
  pickupLine: string
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: prof } = await admin
    .from("profiles")
    .select("expo_push_token")
    .eq("id", driverId)
    .maybeSingle();

  const token = prof?.expo_push_token;
  if (typeof token !== "string" || !token) return;

  const line = pickupLine.length > 90 ? `${pickupLine.slice(0, 87)}…` : pickupLine;
  const res = await sendExpoPushMessages([
    {
      to: token,
      title: "New trip request",
      body: line || "Open the app to view details.",
      data: { type: "trip_offer", trip_id: tripId },
      sound: "default",
    },
  ]);
  if (!res.ok) {
    console.error("notifyDriverTripOfferPush: expo", tripId, driverId);
  }
}
