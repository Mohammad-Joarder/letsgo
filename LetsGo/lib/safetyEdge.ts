import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

type OkErr = { ok: boolean; error?: string };

export async function tripSos(trip_id: string): Promise<OkErr> {
  return invokeEdgeFunction<OkErr>("trip-sos", { trip_id });
}

export async function submitRating(body: {
  trip_id: string;
  to_user_id: string;
  rating: number;
  comment?: string | null;
  tags?: string[] | null;
}): Promise<OkErr> {
  return invokeEdgeFunction<OkErr>("submit-rating", body as unknown as Record<string, unknown>);
}
