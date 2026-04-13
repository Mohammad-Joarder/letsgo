import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useNearbyDrivers } from "@/hooks/useNearbyDrivers";
import { useTripStatus } from "@/hooks/useTripStatus";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { riderCancelTrip } from "@/lib/riderEdge";
import { supabase } from "@/lib/supabase";

type TripLite = {
  rider_id: string;
  status: string;
  pickup_pin: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  ride_type: "economy" | "comfort" | "premium" | "xl";
  created_at: string;
};

export default function SearchingScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [trip, setTrip] = useState<TripLite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const cancelHookRefetchCountRef = useRef(0);

  const radar = useSharedValue(0.6);
  useEffect(() => {
    radar.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 1400 }), withTiming(0.6, { duration: 0 })),
      -1,
      false
    );
  }, [radar]);

  const radarStyle = useAnimatedStyle(() => ({
    opacity: 0.35,
    transform: [{ scale: radar.value }],
  }));

  const loadTrip = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "rider_id, status, pickup_pin, pickup_lat, pickup_lng, pickup_address, ride_type, created_at"
      )
      .eq("id", tripId)
      .maybeSingle();
    if (qErr) {
      setLoadError(qErr.message);
      setBootLoading(false);
      return;
    }
    if (!data || data.rider_id !== user.id) {
      setLoadError("Trip not found.");
      setBootLoading(false);
      return;
    }
    setTrip(data as TripLite);
    setLoadError(null);
    setBootLoading(false);
  }, [tripId, user?.id]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    cancelHookRefetchCountRef.current = 0;
  }, [tripId]);

  const { status } = useTripStatus(tripId, { enabled: Boolean(tripId) });

  const mergedStatus = status ?? trip?.status ?? null;

  useEffect(() => {
    if (!trip || bootLoading || trip.status !== "searching") return;
    if (!status || status === "searching") return;
    if (status === "cancelled") {
      if (cancelHookRefetchCountRef.current >= 1) return;
      cancelHookRefetchCountRef.current += 1;
      void loadTrip();
      return;
    }
    void loadTrip();
  }, [status, trip, bootLoading, loadTrip]);

  useEffect(() => {
    if (!tripId || bootLoading || !trip) return;
    const st = mergedStatus ?? trip.status;
    if (!st) return;

    if (trip.status === "cancelled" || trip.status === "no_driver_found") {
      router.replace("/(rider)/(tabs)/home" as Href);
      return;
    }

    if (st === "driver_accepted" || st === "driver_arrived") {
      router.replace(
        `/(rider)/trip-awaiting-pickup?tripId=${encodeURIComponent(tripId)}` as Href
      );
      return;
    }
    if (st === "in_progress") {
      router.replace(`/(rider)/trip-live?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
    if (st === "completed") {
      router.replace(`/(rider)/trip-complete?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
  }, [tripId, trip, bootLoading, mergedStatus, router, loadTrip]);

  const { drivers } = useNearbyDrivers({
    pickupLat: trip?.pickup_lat,
    pickupLng: trip?.pickup_lng,
    rideType: trip?.ride_type ?? "economy",
    enabled: Boolean(trip && trip.status === "searching"),
    intervalMs: 10_000,
  });

  const etaHint = useMemo(() => {
    if (!drivers.length) return "We’re finding the closest driver…";
    const best = Math.min(...drivers.map((d) => d.eta_min));
    return `A driver may be ~${Math.max(1, Math.round(best))} min away`;
  }, [drivers]);

  const region = useMemo(() => {
    if (!trip) {
      return {
        latitude: -33.8688,
        longitude: 151.2093,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return {
      latitude: Number(trip.pickup_lat),
      longitude: Number(trip.pickup_lng),
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [trip]);

  useEffect(() => {
    if (trip && mapRef.current) {
      mapRef.current.animateToRegion(region, 600);
    }
  }, [trip, region]);

  async function onCancel() {
    if (!tripId) return;
    setCancelling(true);
    try {
      const res = await riderCancelTrip(tripId);
      if (!res.ok) throw new Error(res.error ?? "Cancel failed");
      if (res.fee_aud && res.fee_aud > 0) {
        Alert.alert(
          "Trip cancelled",
          `A cancellation fee of $${res.fee_aud.toFixed(2)} applies (Stripe billing in a later phase).`
        );
      }
      router.replace("/(rider)/(tabs)/home" as Href);
    } catch (e) {
      Alert.alert("Could not cancel", e instanceof Error ? e.message : "Try again.");
    } finally {
      setCancelling(false);
    }
  }

  const mapReady = Platform.OS !== "web";

  if (bootLoading) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (loadError || !trip) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="font-inter text-center text-error">{loadError ?? "Missing trip."}</Text>
          <View className="mt-6 w-full max-w-sm">
            <Button title="Back to home" onPress={() => router.replace("/(rider)/(tabs)/home" as Href)} />
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (trip.status !== "searching") {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text className="font-inter mt-4 text-textSecondary">Updating trip…</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background">
        {mapReady ? (
          <>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              customMapStyle={mapDarkStyle}
              initialRegion={region}
              showsUserLocation={false}
            >
              <Marker
                coordinate={{ latitude: Number(trip.pickup_lat), longitude: Number(trip.pickup_lng) }}
                title="Pickup"
                pinColor="#00D4AA"
              />
              <Circle
                center={{ latitude: Number(trip.pickup_lat), longitude: Number(trip.pickup_lng) }}
                radius={280}
                strokeColor="rgba(0, 212, 170, 0.35)"
                fillColor="rgba(0, 212, 170, 0.06)"
              />
            </MapView>
            <Animated.View
              pointerEvents="none"
              style={[
                radarStyle,
                {
                  position: "absolute",
                  left: "35%",
                  right: "35%",
                  top: "32%",
                  aspectRatio: 1,
                  borderRadius: 9999,
                  borderWidth: 2,
                  borderColor: "rgba(0, 212, 170, 0.45)",
                },
              ]}
            />
          </>
        ) : (
          <View className="flex-1 items-center justify-center bg-surface">
            <ActivityIndicator color="#00D4AA" />
          </View>
        )}

        <View className="absolute left-4 right-4 top-14 flex-row items-center justify-between">
          <Text className="font-sora-display text-xl font-bold text-white drop-shadow-md">
            Finding your driver
          </Text>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(rider)/(tabs)/home" as Href);
            }}
            hitSlop={12}
            className="rounded-full bg-black/40 p-2"
          >
            <Ionicons name="close" size={24} color="#E8ECF2" />
          </Pressable>
        </View>

        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 px-6 pb-10 pt-5">
          <View className="mb-4 items-center">
            <View className="mb-3 h-16 w-16 items-center justify-center rounded-full border-2 border-primary/70 bg-primary/10">
              <Animated.View
                style={radarStyle}
                className="absolute h-14 w-14 rounded-full border border-primary/40"
              />
              <Ionicons name="navigate" size={28} color="#00D4AA" />
            </View>
            <Text className="font-sora text-center text-lg font-semibold text-text">
              Finding your driver…
            </Text>
            <Text className="font-inter mt-2 text-center text-sm text-textSecondary">{etaHint}</Text>
            <Text className="font-inter mt-1 text-center text-xs text-textSecondary">
              Free cancellation until a driver is assigned
            </Text>
          </View>
          <Button
            title="Cancel search"
            variant="secondary"
            loading={cancelling}
            onPress={() => void onCancel()}
          />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
