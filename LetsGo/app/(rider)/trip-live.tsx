import type { Href } from "expo-router";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { useAuth } from "@/hooks/useAuth";
import { removeSupabaseChannelsForTopic } from "@/lib/realtimeChannelTeardown";
import { supabase } from "@/lib/supabase";

type TripRow = {
  status: string;
  rider_id: string;
  driver_id: string | null;
  dropoff_address: string;
  estimated_fare: number | null;
  final_fare: number | null;
};

export default function RiderTripLiveScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goComplete = useCallback(
    (id: string) => {
      router.replace(`/(rider)/trip-complete?tripId=${encodeURIComponent(id)}` as Href);
    },
    [router]
  );

  const load = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select("status, rider_id, driver_id, dropoff_address, estimated_fare, final_fare")
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
    const t = data as TripRow;
    setError(null);
    setTrip(t);
    if (t.status === "completed") {
      goComplete(tripId);
      return;
    }
    if (t.status === "cancelled" || t.status === "no_driver_found") {
      router.replace("/(rider)/(tabs)/home" as Href);
      return;
    }
    if (t.status !== "in_progress") {
      router.replace(`/(rider)/searching?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
    if (t.driver_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", t.driver_id)
        .maybeSingle();
      setDriverName(prof?.full_name ?? "Your driver");
    } else {
      setDriverName(null);
    }
    setLoading(false);
  }, [tripId, user?.id, goComplete, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tripId || !user?.id) return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [tripId, user?.id, load]);

  useEffect(() => {
    if (!tripId || !user?.id) return undefined;
    const topic = `trip_updates:${tripId}`;
    let cancelled = false;

    async function setup() {
      await removeSupabaseChannelsForTopic(supabase, topic);
      if (cancelled) return;

      const ch = supabase
        .channel(topic)
        .on("broadcast", { event: "status" }, ({ payload }) => {
          const p = payload as { status?: string };
          if (p?.status === "completed") {
            goComplete(tripId);
            return;
          }
          void load();
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
            const next = payload.new as { status?: string };
            if (next.status === "completed") {
              goComplete(tripId);
              return;
            }
            void load();
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
  }, [tripId, user?.id, load, goComplete]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [load])
  );

  if (loading && !trip) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="font-inter text-center text-error">{error ?? "Unable to load trip."}</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (trip.status !== "in_progress") {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background px-6">
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text className="font-inter mt-4 text-center text-textSecondary">Updating trip…</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-6 pt-6">
        <Text className="font-sora-display text-2xl font-bold text-text">Trip in progress</Text>
        <Text className="font-inter mt-2 text-sm text-textSecondary">
          Sit back and relax. We will show a receipt when you arrive.
        </Text>

        <View className="mt-10 rounded-3xl border border-primary/30 bg-primary/5 px-6 py-8">
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Driver</Text>
          <Text className="font-sora mt-1 text-xl font-semibold text-text">{driverName ?? "—"}</Text>
          <View className="mt-6 h-px bg-border" />
          <Text className="font-inter mt-6 text-xs font-semibold uppercase text-textSecondary">Drop-off</Text>
          <Text className="font-inter mt-2 text-base leading-6 text-text">{trip.dropoff_address}</Text>
          <Text className="font-inter mt-6 text-xs text-textSecondary">
            Estimated fare: ${Number(trip.estimated_fare ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
