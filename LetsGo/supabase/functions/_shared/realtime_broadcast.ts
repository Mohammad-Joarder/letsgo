/** Server-side Realtime Broadcast (see https://supabase.com/docs/guides/realtime/broadcast) */
const BROADCAST_TIMEOUT_MS = 12_000;

/** Never block trip creation on broadcast; timeout avoids hung "Booking your ride…" on the client. */
export async function realtimeBroadcast(
  supabaseUrl: string,
  serviceRoleKey: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), BROADCAST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[realtimeBroadcast]", res.status, t);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[realtimeBroadcast]", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(tid);
  }
}
