import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

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
    if (!data || data.rider_id !== user?.id) {
      setError("Trip not found.");
      setLoading(false);
      return;
    }
    setStatus(data.status);
    setPin(data.pickup_pin);
    setLoading(false);
  }, [tripId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tripId) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [tripId, load]);

  useEffect(() => {
    if (!tripId || !user?.id) return;
    const ch = supabase
      .channel(`trip:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          const next = payload.new as { status?: string; pickup_pin?: string };
          if (next.status) setStatus(next.status);
          if (next.pickup_pin) setPin(next.pickup_pin);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
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

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-6">
        <View className="mb-8 mt-4 flex-row items-center justify-between">
          <Text className="font-sora-display text-2xl font-bold text-text">Finding a driver</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#8A94A6" />
          </Pressable>
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
                {status === "searching"
                  ? "Matching you with nearby drivers…"
                  : `Status: ${status?.replace(/_/g, " ")}`}
              </Text>
              {pin ? (
                <Text className="font-inter mt-4 text-center text-sm text-textSecondary">
                  Pickup PIN for your driver:{" "}
                  <Text className="font-sora text-base font-bold text-primary">{pin}</Text>
                </Text>
              ) : null}
            </View>

            <View className="mt-auto pb-8">
              <Button
                title="Cancel search"
                variant="secondary"
                loading={cancelling}
                onPress={() => void cancelSearch()}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaWrapper>
  );
}
