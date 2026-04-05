import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { removeSupabaseChannelsForTopic } from "@/lib/realtimeChannelTeardown";
import { supabase } from "@/lib/supabase";

function riderTripHeadline(status: string | null): string {
  switch (status) {
    case "searching":
      return "Matching you with nearby drivers…";
    case "driver_accepted":
      return "A driver accepted — they’re on the way to you.";
    case "driver_arrived":
      return "Your driver has arrived at pickup.";
    case "in_progress":
      return "Trip in progress.";
    case "no_driver_found":
      return "No drivers available right now.";
    case "cancelled":
      return "This trip was cancelled.";
    default:
      return status ? `Status: ${status.replace(/_/g, " ")}` : "Updating…";
  }
}

export default function SearchingScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) {
      setError("Missing trip.");
      setLoading(false);
      return;
    }
    if (!user?.id) {
      return;
    }
    const { data, error: qErr } = await supabase
      .from("trips")
      .select("status, pickup_pin, rider_id")
      .eq("id", tripId)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }
    if (!data || data.rider_id !== user.id) {
      setError("Trip not found.");
      setLoading(false);
      return;
    }
    setError(null);
    setStatus(data.status);
    setPin(data.pickup_pin);
    setLoading(false);
  }, [tripId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tripId || loading || !status) return;
    if (status === "in_progress") {
      router.replace(`/(rider)/trip-live?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
    if (status === "completed") {
      router.replace(`/(rider)/trip-complete?tripId=${encodeURIComponent(tripId)}` as Href);
    }
  }, [tripId, status, loading, router]);

  useEffect(() => {
    if (!tripId) return;
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [tripId, load]);

  useEffect(() => {
    if (!tripId || !user?.id) return undefined;
    const topic = `trip_updates:${tripId}`;
    let cancelled = false;

    const applyTripPatch = (next: { status?: string; pickup_pin?: string | null }) => {
      if (next.status) setStatus(next.status);
      if (next.pickup_pin != null) setPin(next.pickup_pin);
    };

    async function setup() {
      await removeSupabaseChannelsForTopic(supabase, topic);
      if (cancelled) return;

      const ch = supabase
        .channel(topic)
        .on("broadcast", { event: "status" }, ({ payload }) => {
          const p = payload as { status?: string; pickup_pin?: string };
          applyTripPatch(p);
        })
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trips",
            filter: `id=eq.${tripId}`,
          },
          (payload) => {
            applyTripPatch(payload.new as { status?: string; pickup_pin?: string | null });
          }
        )
        .subscribe();

      if (cancelled) {
        await supabase.removeChannel(ch);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      void removeSupabaseChannelsForTopic(supabase, topic);
    };
  }, [tripId, user?.id]);

  async function cancelSearch() {
    if (!tripId) return;
    setCancelling(true);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from("trips")
        .update({
          status: "cancelled",
          cancellation_reason: "rider_cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", tripId)
        .eq("rider_id", user?.id ?? "");
      if (uErr) throw uErr;
      router.replace("/(rider)/(tabs)/home" as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  }

  const canDismissModal = status === "searching" || status === "no_driver_found";
  const canCancelSearch = status === "searching";

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-6">
        <View className="mb-8 mt-4 flex-row items-center justify-between">
          <Text className="font-sora-display text-2xl font-bold text-text">Finding a driver</Text>
          {canDismissModal ? (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(rider)/(tabs)/home" as Href);
              }}
              hitSlop={12}
            >
              <Ionicons name="close" size={28} color="#8A94A6" />
            </Pressable>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#00D4AA" />
          </View>
        ) : error ? (
          <Text className="font-inter text-center text-error">{error}</Text>
        ) : (
          <>
            <View className="items-center rounded-3xl border border-primary/30 bg-primary/5 px-6 py-10">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-full border-2 border-primary/60">
                <View className="h-16 w-16 rounded-full bg-primary/20" />
              </View>
              <Text className="font-sora text-center text-lg font-semibold text-text">
                {riderTripHeadline(status)}
              </Text>
              {pin ? (
                <Text className="font-inter mt-4 text-center text-sm text-textSecondary">
                  Pickup PIN for your driver:{" "}
                  <Text className="font-sora text-base font-bold text-primary">{pin}</Text>
                </Text>
              ) : null}
            </View>

            {canCancelSearch ? (
              <View className="mt-auto pb-8">
                <Button
                  title="Cancel search"
                  variant="secondary"
                  loading={cancelling}
                  onPress={() => void cancelSearch()}
                />
              </View>
            ) : (
              <View className="mt-auto pb-8">
                <Text className="font-inter text-center text-xs text-textSecondary">
                  A driver is on the way — cancel from support if you need help.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaWrapper>
  );
}
