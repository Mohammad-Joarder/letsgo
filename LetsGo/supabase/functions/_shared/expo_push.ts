/** Expo Push API — https://docs.expo.dev/push-notifications/sending-notifications/ */

export async function sendExpoPushMessages(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: "default" | null;
    badge?: number;
  }>
): Promise<{ ok: boolean; raw?: string }> {
  const cleaned = messages.filter(
    (m) =>
      typeof m.to === "string" &&
      (m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken["))
  );
  if (!cleaned.length) return { ok: true };

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleaned),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error("expo push http", res.status, raw);
    return { ok: false, raw };
  }
  return { ok: true, raw };
}
