import type { Href } from "expo-router";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Switch, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useDriverMapLocation } from "@/hooks/useDriverMapLocation";
import { useProfile } from "@/hooks/useProfile";
import { updateDriverLocation } from "@/lib/driverEdge";
import { getCurrentPositionReliable } from "@/lib/location";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { supabase } from "@/lib/supabase";

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const mapRef = useRef<MapView>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [driverRowLoading, setDriverRowLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [todayTrips, setTodayTrips] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [tabFocused, setTabFocused] = useState(true);

  const { coord, region, onRegionChangeComplete, syncError } = useDriverMapLocation({
    /** Keep streaming on Home whenever online; stack screens (pickup / active trip) run their own GPS. */
    active: isOnline && tabFocused,
    mapRef,
    serverPushIntervalMs: 5000,
    exponentialBackoffOnPushFailure: true,
  });

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!isOnline) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
  }, [isOnline, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.85,
  }));

  const loadDriverRow = useCallback(async () => {
    if (!user?.id) {
      setDriverRowLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("drivers")
      .select("is_online, current_status, rating")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) {
      setIsOnline(Boolean(data.is_online) && data.current_status !== "offline");
      setRating(data.rating != null ? Number(data.rating) : null);
    }
    setDriverRowLoading(false);
  }, [user?.id]);

  const loadTodayStats = useCallback(async () => {
    if (!user?.id) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("trips")
      .select("final_fare")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .gte("trip_completed_at", start.toISOString());
    const rows = data ?? [];
    setTodayTrips(rows.length);
    const sum = rows.reduce((s, r) => s + Number(r.final_fare ?? 0), 0);
    setTodayEarnings(sum);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      void loadDriverRow();
      void loadTodayStats();
      return () => setTabFocused(false);
    }, [loadDriverRow, loadTodayStats])
  );

  const resumeActiveTrip = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("trips")
      .select("id, status")
      .eq("driver_id", user.id)
      .in("status", ["driver_accepted", "driver_arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    if (data.status === "driver_accepted") {
      router.replace(`/(driver)/pickup-navigation?tripId=${data.id}` as Href);
    } else {
      router.replace(`/(driver)/trip-active?tripId=${data.id}` as Href);
    }
  }, [user?.id, router]);

  useFocusEffect(
    useCallback(() => {
      void resumeActiveTrip();
    }, [resumeActiveTrip])
  );

  async function onToggleOnline(next: boolean) {
    if (!user?.id) return;
    setLocError(null);

    if (!next) {
      const { data: active } = await supabase
        .from("trips")
        .select("id")
        .eq("driver_id", user.id)
        .in("status", ["driver_accepted", "driver_arrived", "in_progress"])
        .limit(1)
        .maybeSingle();
      if (active) {
        Alert.alert("Finish your trip", "Complete or cancel the active trip before going offline.");
        return;
      }
    }

    setToggling(true);
    try {
      if (next) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocError("Location permission is required to go online.");
          setToggling(false);
          return;
        }
        const { lat, lng } = await getCurrentPositionReliable();
        try {
          await updateDriverLocation(lat, lng);
        } catch (e) {
          throw new Error(
            e instanceof Error ? e.message : "Could not sync your location. Check connection and try again."
          );
        }
        const { error } = await supabase
          .from("drivers")
          .update({ is_online: true, current_status: "online" })
          .eq("id", user.id);
        if (error) throw error;
        setIsOnline(true);
      } else {
        const { error } = await supabase
          .from("drivers")
          .update({ is_online: false, current_status: "offline" })
          .eq("id", user.id);
        if (error) throw error;
        setIsOnline(false);
      }
    } catch (e) {
      Alert.alert("Could not update status", e instanceof Error ? e.message : "Try again.");
    } finally {
      setToggling(false);
    }
  }

  const mapReady = Platform.OS !== "web";

  return (
    <View className="flex-1 bg-background">
      {mapReady ? (
        region ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            customMapStyle={mapDarkStyle}
            initialRegion={region}
            showsUserLocation={false}
            onRegionChangeComplete={onRegionChangeComplete}
          >
            {coord ? (
              <Marker coordinate={{ latitude: coord.lat, longitude: coord.lng }} title="You">
                <View className="h-4 w-4 rounded-full border-2 border-white bg-primary" />
              </Marker>
            ) : null}
          </MapView>
        ) : (
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color="#00D4AA" />
            <Text className="font-inter mt-3 text-sm text-textSecondary">Finding your location…</Text>
          </View>
        )
      ) : (
        <View className="flex-1 items-center justify-center bg-surface px-6">
          <Text className="font-inter text-center text-textSecondary">Map runs on iOS and Android.</Text>
        </View>
      )}

      <View
        className="absolute left-0 right-0 px-4"
        style={{ top: insets.top + 8 }}
        pointerEvents="box-none"
      >
        <View className="rounded-2xl border border-border/80 bg-background/90 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-inter text-xs text-textSecondary">Driver</Text>
              <Text className="font-sora text-lg font-semibold text-text" numberOfLines={1}>
                {profile?.full_name ?? "Partner"}
              </Text>
            </View>
            {driverRowLoading ? (
              <ActivityIndicator color="#00D4AA" />
            ) : (
              <View className="flex-row items-center gap-2">
                {isOnline ? (
                  <Animated.View style={dotStyle} className="h-3 w-3 rounded-full bg-primary" />
                ) : (
                  <View className="h-3 w-3 rounded-full bg-textSecondary" />
                )}
                <Switch
                  value={isOnline}
                  disabled={toggling}
                  onValueChange={(v) => void onToggleOnline(v)}
                  trackColor={{ false: "#2A3548", true: "#00D4AA55" }}
                  thumbColor={isOnline ? "#00D4AA" : "#8A94A6"}
                />
              </View>
            )}
          </View>
          <Text className="font-inter mt-2 text-sm text-textSecondary">
            {isOnline ? "You are online — offers will appear here." : "Go online to receive trips."}
          </Text>
          {locError || syncError ? (
            <Text className="font-inter mt-2 text-xs text-error">{locError ?? syncError}</Text>
          ) : null}
        </View>
      </View>

      {isOnline ? (
        <View
          className="absolute left-4 right-4 rounded-2xl border border-border bg-surface/95 px-4 py-3"
          style={{ bottom: insets.bottom + 100 }}
        >
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Today</Text>
          <View className="mt-2 flex-row justify-between">
            <Stat label="Trips" value={String(todayTrips)} />
            <Stat label="Earnings" value={`$${todayEarnings.toFixed(2)}`} />
            <Stat label="Rating" value={rating != null ? rating.toFixed(1) : "—"} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="font-inter text-xs text-textSecondary">{label}</Text>
      <Text className="font-sora text-base font-bold text-text">{value}</Text>
    </View>
  );
}
