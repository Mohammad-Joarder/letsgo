/**
 * Supabase Realtime `subscribe((status, err) => …)` often omits `err` on CHANNEL_ERROR.
 * Use this so logs never print `undefined`.
 */
export function formatRealtimeSubscribeErr(err: unknown): string {
  if (err == null) {
    return "no detail (websocket / auth / Realtime policy)";
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
