import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase reuses channels by topic; listeners cannot be added after join. Remove stale channels before subscribing. */
export async function removeSupabaseChannelsForTopic(
  client: SupabaseClient,
  topicWithoutRealtimePrefix: string
): Promise<void> {
  const fullTopic = `realtime:${topicWithoutRealtimePrefix}`;
  const matches = client.getChannels().filter((c) => c.topic === fullTopic);
  for (const ch of matches) {
    await client.removeChannel(ch);
  }
}
