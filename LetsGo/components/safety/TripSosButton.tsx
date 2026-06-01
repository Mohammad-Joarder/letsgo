import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import { tripSos } from "@/lib/safetyEdge";

type Props = {
  tripId: string | null | undefined;
  /** Compact pill (default) or icon-only */
  variant?: "pill" | "icon";
};

export function TripSosButton({ tripId, variant = "pill" }: Props) {
  const [busy, setBusy] = useState(false);

  function openEmergencyDial() {
    void Linking.openURL("tel:000");
  }

  function confirmAndSend() {
    if (!tripId) return;
    Alert.alert(
      "Send SOS alert?",
      "We'll notify Lets Go safety staff, log this trip, and you can call 000 immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send SOS",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const res = await tripSos(tripId);
                if (!res.ok) throw new Error(res.error ?? "Could not send SOS");
                Alert.alert("SOS sent", "Support has been notified. If you are in danger, call 000 now.", [
                  { text: "Call 000", style: "destructive", onPress: openEmergencyDial },
                  { text: "OK" },
                ]);
              } catch (e) {
                Alert.alert("SOS failed", e instanceof Error ? e.message : "Try again.");
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  }

  if (variant === "icon") {
    return (
      <Pressable
        onPress={confirmAndSend}
        disabled={!tripId || busy}
        hitSlop={12}
        className="h-10 w-10 items-center justify-center rounded-full border border-red-500/80 bg-red-500/20"
      >
        {busy ? (
          <ActivityIndicator color="#f87171" size="small" />
        ) : (
          <Ionicons name="shield" size={20} color="#f87171" />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={confirmAndSend}
      disabled={!tripId || busy}
      className="flex-row items-center gap-2 rounded-full border border-red-500/80 bg-red-500/20 px-3 py-2"
    >
      {busy ? (
        <ActivityIndicator color="#f87171" size="small" />
      ) : (
        <Ionicons name="shield" size={16} color="#f87171" />
      )}
      <Text className="font-inter text-xs font-bold text-red-400">SOS</Text>
    </Pressable>
  );
}
