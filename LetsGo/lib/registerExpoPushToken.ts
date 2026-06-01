import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests permission (when needed), resolves Expo push token, saves to `profiles.expo_push_token`.
 * Safe to call on every session; no-ops when permission denied or project id missing.
 */
export async function registerExpoPushTokenForUser(userId: string): Promise<void> {
  if (Platform.OS === "web") return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] EAS project id missing — set extra.eas.projectId in app.config.js / EAS_PROJECT_ID.");
    return;
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes.data;
  if (!token) return;

  const { error } = await supabase.from("profiles").update({ expo_push_token: token }).eq("id", userId);
  if (error) console.warn("[push] profile update", error.message);
}
