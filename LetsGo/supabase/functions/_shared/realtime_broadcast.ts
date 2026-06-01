/** Server-side Realtime Broadcast (see https://supabase.com/docs/guides/realtime/broadcast) */
/** One attempt must stay bounded: create-trip is awaited by the rider app. */
const BROADCAST_TIMEOUT_MS = 8_000;
const BROADCAST_RETRIES = 3;
const BROADCAST_RETRY_DELAY_MS = 300;

type BroadcastMessage = {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  /** Public channel must match the JS client default (`config.private: false`) or delivery fails. */
  private: false;
};

async function postBroadcastOnce(
  supabaseUrl: string,
  serviceRoleKey: string,
  message: BroadcastMessage
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
        messages: [message],
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

/** Retries: transient 429/5xx or one-off network drops on Edge should not miss the only offer broadcast. */
export async function realtimeBroadcast(
  supabaseUrl: string,
  serviceRoleKey: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const message: BroadcastMessage = { topic, event, payload, private: false };
  for (let attempt = 0; attempt < BROADCAST_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BROADCAST_RETRY_DELAY_MS * attempt));
    }
    if (await postBroadcastOnce(supabaseUrl, serviceRoleKey, message)) return true;
  }
  return false;
}
