import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import type { Href } from "expo-router";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DriverMarker } from "@/components/rider/DriverMarker";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { useAuth } from "@/hooks/useAuth";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useTripStatus } from "@/hooks/useTripStatus";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { supabase } from "@/lib/supabase";

const SHARE_BASE = "https://letsgo.app/track/";

type TripRow = {
  status: string;
  rider_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  estimated_fare: number | null;
  final_fare: number | null;
};

export default function RiderTripLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const { location: driverLoc } = useDriverLocation(trip?.driver_id ?? null, Boolean(trip?.driver_id));

  const goComplete = useCallback(
    (id: string) => {
      router.replace(`/(rider)/trip-complete?tripId=${encodeURIComponent(id)}` as Href);
    },
    [router]
  );

  const { status } = useTripStatus(tripId, { enabled: Boolean(tripId) });

  const load = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "status, rider_id, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, dropoff_address, estimated_fare, final_fare"
      )
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
    if (t.status === "searching") {
      router.replace(`/(rider)/searching?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
    if (t.status === "driver_accepted" || t.status === "driver_arrived") {
      router.replace(`/(rider)/trip-awaiting-pickup?tripId=${encodeURIComponent(tripId)}` as Href);
      return;
    }
    if (t.status !== "in_progress") {
      setLoading(false);
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
    if (!tripId) return;
    if (status === "completed") {
      goComplete(tripId);
      return;
    }
    if (status === "cancelled" || status === "no_driver_found") {
      router.replace("/(rider)/(tabs)/home" as Href);
    }
  }, [tripId, status, goComplete, router]);

  useEffect(() => {
    if (!trip || trip.status !== "in_progress") return;
    if (!driverLoc) return;
    let alive = true;
    void (async () => {
      const route = await fetchRoutePolyline(
        driverLoc.lat,
        driverLoc.lng,
        trip.dropoff_lat,
        trip.dropoff_lng
      );
      if (!alive || !route?.coordinates?.length) return;
      setCoords(route.coordinates);
      setEtaMin(Math.max(1, Math.round(route.durationSeconds / 60)));
      mapRef.current?.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 110, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    })();
    return () => {
      alive = false;
    };
  }, [trip, driverLoc?.lat, driverLoc?.lng]);

  useFocusEffect(
    useCallback(() => {
      void load();
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [load])
  );

  async function shareTrip() {
    if (!tripId) return;
    const url = `${SHARE_BASE}${tripId}`;
    try {
      await Clipboard.setStringAsync(url);
      await Share.share({
        message: `Follow my Lets Go trip: ${url}`,
        url: Platform.OS === "ios" ? url : undefined,
      });
    } catch {
      Alert.alert("Share", "Could not open share sheet.");
    }
  }

  const mapReady = Platform.OS !== "web";

  if (loading && !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-inter text-center text-error">{error ?? "Unable to load trip."}</Text>
      </View>
    );
  }

  if (trip.status !== "in_progress") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator size="large" color="#00D4AA" />
        <Text className="font-inter mt-4 text-center text-textSecondary">Updating trip…</Text>
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
            latitude: trip.dropoff_lat,
            longitude: trip.dropoff_lng,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
        >
          <Marker
            coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }}
            title="Pickup"
            pinColor="#3B82F6"
          />
          <Marker
            coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }}
            title="Drop-off"
            pinColor="#F97316"
          />
          {coords.length > 1 ? <RoutePolyline coordinates={coords} /> : null}
          {driverLoc ? (
            <DriverMarker
              driverId={trip.driver_id ?? "drv"}
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
        className="absolute left-3 right-3 flex-row items-center justify-between"
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
        <Pressable
          onPress={() => void shareTrip()}
          className="flex-row items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2"
        >
          <Ionicons name="share-outline" size={18} color="#E8ECF2" />
          <Text className="font-inter text-xs font-semibold text-text">Share trip</Text>
        </Pressable>
      </View>

      <View
        className="absolute left-3 right-3 rounded-2xl border border-border bg-background/95 px-4 py-3"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Driver</Text>
        <Text className="font-sora mt-0.5 text-lg font-semibold text-text">{driverName ?? "—"}</Text>
        <Text className="font-inter mt-2 text-xs text-textSecondary">
          ETA to drop-off{etaMin != null ? `: ~${etaMin} min` : ""}
        </Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary" numberOfLines={2}>
          {trip.dropoff_address}
        </Text>
        <Text className="font-inter mt-2 text-xs text-textSecondary">
          Final fare is confirmed when you arrive
        </Text>
      </View>
    </View>
  );
}
