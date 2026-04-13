import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import type { Href } from "expo-router";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DriverMarker } from "@/components/rider/DriverMarker";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useTripStatus } from "@/hooks/useTripStatus";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { haversineMeters } from "@/lib/geo";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { riderCancelTrip } from "@/lib/riderEdge";
import { supabase } from "@/lib/supabase";

type VehicleRow = { make: string; model: string; color: string; plate_number: string };

export default function TripAwaitingPickupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const hasFittedRouteRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverRating, setDriverRating] = useState<number>(5);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [pickupLat, setPickupLat] = useState(0);
  const [pickupLng, setPickupLng] = useState(0);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPin, setPickupPin] = useState<string | null>(null);
  const [riderVerified, setRiderVerified] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { location: driverLoc } = useDriverLocation(driverId, Boolean(driverId));

  const { status } = useTripStatus(tripId, { enabled: Boolean(tripId) });

  const load = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "rider_id, driver_id, status, pickup_lat, pickup_lng, pickup_address, pickup_pin, vehicle_id"
      )
      .eq("id", tripId)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message ?? "Trip not found.");
      setLoading(false);
      return;
    }
    if (data.rider_id !== user.id) {
      setError("Trip not found.");
      setLoading(false);
      return;
    }
    const st = data.status as string;
    if (st === "searching") {
      router.replace(`/(rider)/searching?tripId=${encodeURIComponent(tripId)}` as Href);
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
    if (st === "cancelled" || st === "no_driver_found") {
      router.replace("/(rider)/(tabs)/home" as Href);
      return;
    }

    setPickupLat(Number(data.pickup_lat));
    setPickupLng(Number(data.pickup_lng));
    setPickupAddress(String(data.pickup_address ?? ""));
    setPickupPin(data.pickup_pin != null ? String(data.pickup_pin) : null);
    const did = data.driver_id as string | null;
    setDriverId(did);

    const { data: me } = await supabase.from("profiles").select("is_verified").eq("id", user.id).maybeSingle();
    setRiderVerified(Boolean(me?.is_verified));

    if (did) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", did)
        .maybeSingle();
      setDriverName(prof?.full_name ?? "Your driver");
      setDriverPhone(prof?.phone ?? null);
      const { data: drow } = await supabase.from("drivers").select("rating").eq("id", did).maybeSingle();
      if (drow?.rating != null) setDriverRating(Number(drow.rating));
    }

    const vid = data.vehicle_id as string | null;
    if (vid) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("make, model, color, plate_number")
        .eq("id", vid)
        .maybeSingle();
      if (v) setVehicle(v as VehicleRow);
    }

    setError(null);
    setLoading(false);
  }, [tripId, user?.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [load])
  );

  useEffect(() => {
    if (!tripId) return;
    const st = status ?? null;
    if (st === "in_progress") {
      router.replace(`/(rider)/trip-live?tripId=${encodeURIComponent(tripId)}` as Href);
    } else if (st === "completed") {
      router.replace(`/(rider)/trip-complete?tripId=${encodeURIComponent(tripId)}` as Href);
    } else if (st === "cancelled" || st === "no_driver_found") {
      router.replace("/(rider)/(tabs)/home" as Href);
    } else if (st === "searching") {
      router.replace(`/(rider)/searching?tripId=${encodeURIComponent(tripId)}` as Href);
    }
  }, [tripId, status, router]);

  useEffect(() => {
    if (!tripId) hasFittedRouteRef.current = false;
  }, [tripId]);

  useEffect(() => {
    if (!driverLoc || pickupLat === 0) return;
    let alive = true;
    void (async () => {
      const route = await fetchRoutePolyline(driverLoc.lat, driverLoc.lng, pickupLat, pickupLng);
      if (!alive || !route?.coordinates?.length) return;
      setCoords(route.coordinates);
      setEtaMin(Math.max(1, Math.round(route.durationSeconds / 60)));
      if (!hasFittedRouteRef.current) {
        hasFittedRouteRef.current = true;
        mapRef.current?.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 120, right: 36, bottom: 280, left: 36 },
          animated: true,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [driverLoc?.lat, driverLoc?.lng, pickupLat, pickupLng]);

  const arrived = status === "driver_arrived";

  const distM =
    driverLoc != null ? haversineMeters(driverLoc.lat, driverLoc.lng, pickupLat, pickupLng) : null;

  const headline = useMemo(() => {
    if (arrived) return "Your driver has arrived";
    return etaMin != null ? `Driver is ~${etaMin} min away` : "Driver is on the way";
  }, [arrived, etaMin]);

  function onCancel() {
    if (!tripId) return;
    Alert.alert(
      "Cancel this trip?",
      "After 2 minutes with an assigned driver, a cancellation fee may apply.",
      [
        { text: "Keep trip", style: "cancel" },
        {
          text: "Cancel trip",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setCancelling(true);
              try {
                const res = await riderCancelTrip(tripId);
                if (!res.ok) throw new Error(res.error ?? "Cancel failed");
                if (res.fee_aud && res.fee_aud > 0) {
                  Alert.alert(
                    "Trip cancelled",
                    `A cancellation fee of $${res.fee_aud.toFixed(2)} was recorded (billing in Phase 5).`
                  );
                }
                router.replace("/(rider)/(tabs)/home" as Href);
              } catch (e) {
                Alert.alert("Could not cancel", e instanceof Error ? e.message : "Try again.");
              } finally {
                setCancelling(false);
              }
            })();
          },
        },
      ]
    );
  }

  const mapReady = Platform.OS !== "web";

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter text-center text-error">{error}</Text>
        <View className="mt-6 w-full max-w-sm">
          <Button title="Home" onPress={() => router.replace("/(rider)/(tabs)/home" as Href)} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {mapReady ? (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapDarkStyle}
          initialRegion={{
            latitude: pickupLat,
            longitude: pickupLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup" pinColor="#00D4AA" />
          {coords.length > 1 ? <RoutePolyline coordinates={coords} /> : null}
          {driverLoc ? (
            <DriverMarker
              driverId={driverId ?? "driver"}
              latitude={driverLoc.lat}
              longitude={driverLoc.lng}
              headingDeg={driverLoc.bearingDeg}
              pulse={false}
            />
          ) : null}
        </MapView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="font-inter text-textSecondary">Map not available on web.</Text>
        </View>
      )}

      <View
        className="absolute left-3 right-3 flex-row items-center justify-end gap-2"
        style={{ top: insets.top + 8 }}
      >
        <Pressable
          onPress={() =>
            Alert.alert("Emergency", "Call 000 for police, fire, or ambulance?", [
              { text: "No", style: "cancel" },
              { text: "Call 000", style: "destructive", onPress: () => void Linking.openURL("tel:000") },
            ])
          }
          className="rounded-full border border-red-500/80 bg-red-500/20 px-3 py-2"
        >
          <Text className="font-inter text-xs font-bold text-red-400">SOS</Text>
        </Pressable>
      </View>

      <View
        className="absolute left-0 right-0 rounded-t-3xl border border-border bg-background/98 px-5 pt-4 shadow-2xl"
        style={{ bottom: 0, paddingBottom: insets.bottom + 16 }}
      >
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-border" />
        <Text className="font-sora text-lg font-bold text-text">{headline}</Text>
        {distM != null && !arrived ? (
          <Text className="font-inter mt-1 text-xs text-textSecondary">
            ~{Math.round(distM)} m to pickup
          </Text>
        ) : null}

        <View className="mt-4 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface2">
            <Ionicons name="person" size={28} color="#00D4AA" />
          </View>
          <View className="flex-1">
            <Text className="font-sora text-base font-semibold text-text">{driverName}</Text>
            <Text className="font-inter text-xs text-textSecondary">
              {driverRating.toFixed(1)} ★ · {riderVerified ? "Verified rider" : "Rider"}
            </Text>
            {vehicle ? (
              <Text className="font-inter mt-1 text-xs text-text">
                {vehicle.color} {vehicle.make} {vehicle.model} · {vehicle.plate_number}
              </Text>
            ) : null}
          </View>
        </View>

        {pickupPin ? (
          <View className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3">
            <Text className="font-inter text-center text-xs text-textSecondary">
              Show this PIN to your driver
            </Text>
            <Text className="font-sora mt-1 text-center text-3xl font-bold tracking-[0.3em] text-primary">
              {pickupPin}
            </Text>
          </View>
        ) : null}

        <Text className="font-inter mt-3 text-xs text-textSecondary" numberOfLines={2}>
          Pickup: {pickupAddress}
        </Text>

        <View className="mt-4 flex-row gap-3">
          {driverPhone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${driverPhone!.replace(/\s/g, "")}`)}
              className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-80"
            >
              <Text className="font-inter text-sm font-semibold text-primary">Call</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => Alert.alert("Chat", "In-app chat arrives in Phase 9.")}
            className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-80"
          >
            <Text className="font-inter text-sm font-semibold text-text">Chat</Text>
          </Pressable>
        </View>

        <View className="mt-4">
          <Button title="Cancel trip" variant="secondary" loading={cancelling} onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}
