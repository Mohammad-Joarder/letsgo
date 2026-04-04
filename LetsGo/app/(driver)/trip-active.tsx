import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { Button } from "@/components/ui/Button";
import { completeTrip } from "@/lib/driverEdge";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { haversineMeters } from "@/lib/geo";
import { getCurrentPositionReliable, tryGetCurrentPositionReliable } from "@/lib/location";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { supabase } from "@/lib/supabase";

type TripFull = {
  id: string;
  rider_id: string;
  pickup_pin: string | null;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  status: string;
  estimated_fare: number | null;
  trip_started_at: string | null;
};

export default function TripActiveScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [trip, setTrip] = useState<TripFull | null>(null);
  const [riderName, setRiderName] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinOk, setPinOk] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
    if (error || !data) {
      setTrip(null);
      setLoading(false);
      return;
    }
    const t = data as TripFull;
    setTrip(t);
    if (t.status === "in_progress") {
      setPinOk(true);
      if (t.trip_started_at) {
        setStartedAt(new Date(t.trip_started_at).getTime());
      }
    } else {
      setPinOk(false);
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", t.rider_id)
      .maybeSingle();
    setRiderName(prof?.full_name ?? "Rider");
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pinOk || !trip) return;
    let alive = true;
    void (async () => {
      try {
        const { lat, lng } = await getCurrentPositionReliable();
        if (!alive) return;
        setMyPos({ lat, lng });
        const route = await fetchRoutePolyline(lat, lng, trip.dropoff_lat, trip.dropoff_lng);
        if (!alive) return;
        if (route?.coordinates?.length) {
          setCoords(route.coordinates);
          setEtaMin(Math.max(1, Math.round(route.durationSeconds / 60)));
          mapRef.current?.fitToCoordinates(route.coordinates, {
            edgePadding: { top: 100, right: 40, bottom: 260, left: 40 },
            animated: true,
          });
        }
      } catch {
        /* avoid unhandled rejection */
      }
    })();
    return () => {
      alive = false;
    };
  }, [pinOk, trip]);

  useEffect(() => {
    if (!pinOk) return;
    const id = setInterval(() => {
      void (async () => {
        const pos = await tryGetCurrentPositionReliable({
          balancedAttempts: 1,
          lowAttempts: 1,
          retryDelayMs: 0,
        });
        if (pos) setMyPos({ lat: pos.lat, lng: pos.lng });
      })();
    }, 8000);
    return () => clearInterval(id);
  }, [pinOk]);

  useEffect(() => {
    if (!pinOk || startedAt == null) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [pinOk, startedAt]);

  async function startTripDb() {
    if (!tripId) return;
    const { error } = await supabase
      .from("trips")
      .update({
        status: "in_progress",
        trip_started_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("status", "driver_arrived");
    if (error) {
      Alert.alert("Could not start trip", error.message);
      return false;
    }
    return true;
  }

  async function onConfirmPinAndStart() {
    if (!trip?.pickup_pin) {
      setPinError("No PIN on file.");
      return;
    }
    if (pinInput.trim() !== String(trip.pickup_pin)) {
      setPinError("PIN does not match.");
      return;
    }
    setPinError(null);
    const ok = await startTripDb();
    if (ok) {
      setStartedAt(Date.now());
      await load();
    }
  }

  const distDrop =
    trip && myPos
      ? haversineMeters(myPos.lat, myPos.lng, trip.dropoff_lat, trip.dropoff_lng)
      : Infinity;
  const canEnd = distDrop <= 300 && pinOk && trip?.status === "in_progress";

  async function onEndTrip() {
    if (!tripId || !trip) return;
    setEnding(true);
    try {
      const res = await completeTrip({
        trip_id: tripId,
        final_fare: trip.estimated_fare != null ? Number(trip.estimated_fare) : undefined,
      });
      if (!res.ok) throw new Error(res.error ?? "complete-trip failed");
      router.replace(
        `/(driver)/trip-summary?tripId=${tripId}&net=${res.net_earnings ?? 0}&final=${res.final_fare ?? 0}` as Href
      );
    } catch (e) {
      Alert.alert("End trip failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setEnding(false);
    }
  }

  if (loading || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#00D4AA" />
      </View>
    );
  }

  const showPinGate = trip.status === "driver_arrived" && !pinOk;

  return (
    <View className="flex-1 bg-background">
      {Platform.OS !== "web" && pinOk ? (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapDarkStyle}
          initialRegion={{
            latitude: trip.dropoff_lat,
            longitude: trip.dropoff_lng,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
        >
          {coords.length > 1 ? <RoutePolyline coordinates={coords} /> : null}
          <Marker coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }} title="Drop-off" />
          {myPos ? (
            <Marker coordinate={{ latitude: myPos.lat, longitude: myPos.lng }} title="You">
              <View className="h-4 w-4 rounded-full bg-primary" />
            </Marker>
          ) : null}
        </MapView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          {showPinGate ? (
            <>
              <Text className="font-sora text-center text-xl font-bold text-text">
                Ask rider for 4-digit PIN
              </Text>
              <TextInput
                value={pinInput}
                onChangeText={(t) => {
                  setPinInput(t.replace(/\D/g, "").slice(0, 4));
                  setPinError(null);
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="••••"
                placeholderTextColor="#5C6678"
                className="font-sora mt-6 h-14 w-48 rounded-2xl border border-border bg-surface2 text-center text-2xl tracking-widest text-text"
              />
              {pinError ? (
                <Text className="font-inter mt-2 text-sm text-error">{pinError}</Text>
              ) : null}
              <View className="mt-8 w-full max-w-sm">
                <Button
                  title="Verify PIN & start trip"
                  onPress={() => void onConfirmPinAndStart()}
                  disabled={pinInput.length !== 4}
                />
              </View>
            </>
          ) : (
            <Text className="font-inter text-textSecondary">Loading map…</Text>
          )}
        </View>
      )}

      {!showPinGate && pinOk ? (
        <View
          className="absolute left-4 right-4 flex-row items-center rounded-xl border border-border bg-background/95 px-3 py-2"
          style={{ top: insets.top + 8 }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#E8ECF2" />
          </Pressable>
          <Text className="font-sora flex-1 text-center text-sm font-semibold text-text">
            To drop-off{etaMin != null ? ` · ~${etaMin} min` : ""}
          </Text>
          <View className="w-6" />
        </View>
      ) : null}

      {!showPinGate && pinOk ? (
        <View
          className="absolute left-0 right-0 border-t border-border bg-surface px-5 pb-8 pt-4"
          style={{ bottom: 0, paddingBottom: insets.bottom + 16 }}
        >
          <Text className="font-sora text-lg font-semibold text-text">{riderName}</Text>
          <Text className="font-inter mt-2 text-sm text-textSecondary">{trip.dropoff_address}</Text>
          <Text className="font-inter mt-3 text-sm text-text">
            Trip time: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </Text>
          <Text className="font-inter mt-2 text-xs text-textSecondary">
            {canEnd
              ? "Within 300 m of drop-off — you can end the trip."
              : `~${Math.round(distDrop)} m to drop-off.`}
          </Text>
          <View className="mt-4">
            <Button
              title="End Trip"
              disabled={!canEnd}
              loading={ending}
              onPress={() => void onEndTrip()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
