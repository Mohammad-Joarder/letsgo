import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendExpoPushMessages } from "./expo_push.ts";

/**
 * Expo push (if token present) + in-app notifications row (service role).
 */
export async function pushToUser(
  admin: SupabaseClient,
  params: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    type?: string;
  }
): Promise<void> {
  const { data: target } = await admin
    .from("profiles")
    .select("expo_push_token")
    .eq("id", params.userId)
    .maybeSingle();

  const token = target?.expo_push_token as string | null | undefined;
  if (
    token &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  ) {
    const res = await sendExpoPushMessages([
      {
        to: token,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: "default",
        badge: 1,
      },
    ]);
    if (!res.ok) console.error("[pushToUser] expo", res.raw);
  }

  const { error: logErr } = await admin.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    type: params.type ?? "system",
    data: params.data ?? {},
    is_read: false,
  });
  if (logErr) console.error("[pushToUser] notifications insert", logErr);
}
