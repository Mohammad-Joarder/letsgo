import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { Button } from "@/components/ui/Button";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { haversineMeters } from "@/lib/geo";
import { getCurrentPositionReliable, tryGetCurrentPositionReliable } from "@/lib/location";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { supabase } from "@/lib/supabase";

type TripRow = {
  id: string;
  rider_id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  status: string;
};

export default function PickupNavigationScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<MapView>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
    if (error || !data) {
      setTrip(null);
      setLoading(false);
      return;
    }
    const t = data as TripRow;
    setTrip(t);
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", t.rider_id)
      .maybeSingle();
    if (prof) {
      setRiderName(prof.full_name ?? "Rider");
      setRiderPhone(prof.phone ?? null);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!trip) return;
    let alive = true;
    void (async () => {
      try {
        const { lat, lng } = await getCurrentPositionReliable();
        if (!alive) return;
        setMyPos({ lat, lng });
        const route = await fetchRoutePolyline(lat, lng, trip.pickup_lat, trip.pickup_lng);
        if (!alive) return;
        if (route?.coordinates?.length) {
          setCoords(route.coordinates);
          setEtaMin(Math.max(1, Math.round(route.durationSeconds / 60)));
          mapRef.current?.fitToCoordinates(route.coordinates, {
            edgePadding: { top: 100, right: 40, bottom: 220, left: 40 },
            animated: true,
          });
        }
      } catch {
        /* avoid unhandled rejection; map still works without live dot */
      }
    })();
    return () => {
      alive = false;
    };
  }, [trip]);

  useEffect(() => {
    if (!trip) return;
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
  }, [trip]);

  const distToPickup =
    trip && myPos
      ? haversineMeters(myPos.lat, myPos.lng, trip.pickup_lat, trip.pickup_lng)
      : Infinity;
  const canArrive = distToPickup <= 200;

  async function onArrived() {
    if (!tripId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "driver_arrived",
          driver_arrived_at: new Date().toISOString(),
        })
        .eq("id", tripId)
        .eq("status", "driver_accepted");
      if (error) throw error;
      router.replace(`/(driver)/trip-active?tripId=${tripId}` as Href);
    } catch (e) {
      Alert.alert("Update failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#00D4AA" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapDarkStyle}
          initialRegion={{
            latitude: trip.pickup_lat,
            longitude: trip.pickup_lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {coords.length > 1 ? <RoutePolyline coordinates={coords} /> : null}
          <Marker coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }} title="Pickup" />
          {myPos ? (
            <Marker coordinate={{ latitude: myPos.lat, longitude: myPos.lng }} title="You">
              <View className="h-4 w-4 rounded-full bg-primary" />
            </Marker>
          ) : null}
        </MapView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-textSecondary">Map not available on web.</Text>
        </View>
      )}

      <View
        className="absolute left-4 right-4 flex-row items-center justify-between rounded-xl border border-border bg-background/95 px-4 py-3"
        style={{ top: insets.top + 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#E8ECF2" />
        </Pressable>
        <Text className="font-sora flex-1 text-center text-base font-semibold text-text">
          Heading to pickup{etaMin != null ? ` — ~${etaMin} min` : ""}
        </Text>
        <View className="w-6" />
      </View>

      <View
        className="absolute left-0 right-0 border-t border-border bg-surface px-5 pb-8 pt-4"
        style={{ bottom: 0, paddingBottom: insets.bottom + 16 }}
      >
        <Text className="font-sora text-lg font-semibold text-text">{riderName}</Text>
        <View className="mt-3 flex-row gap-3">
          {riderPhone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${riderPhone.replace(/\s/g, "")}`)}
              className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-80"
            >
              <Text className="font-inter text-sm font-semibold text-primary">Call</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => Alert.alert("Messages", "In-app chat will arrive in a later phase.")}
            className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-80"
          >
            <Text className="font-inter text-sm font-semibold text-text">Message</Text>
          </Pressable>
        </View>
        <Text className="font-inter mt-4 text-sm leading-5 text-textSecondary">{trip.pickup_address}</Text>
        <Text className="font-inter mt-2 text-xs text-textSecondary">
          {canArrive
            ? "You are within 200 m of the pickup."
            : `~${Math.round(distToPickup)} m to pickup — move closer to enable "I've Arrived".`}
        </Text>
        <View className="mt-4">
          <Button
            title="I've Arrived"
            disabled={!canArrive}
            loading={busy}
            onPress={() => void onArrived()}
          />
        </View>
      </View>
    </View>
  );
}
