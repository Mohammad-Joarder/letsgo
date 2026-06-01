import type { Href } from "expo-router";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { RatingFormBlock } from "@/components/shared/RatingModal";
import { Button } from "@/components/ui/Button";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { useMapStyle } from "@/hooks/useMapStyle";
import { submitRating as postTripRating } from "@/lib/safetyEdge";
import { supabase } from "@/lib/supabase";

export default function TripSummaryScreen() {
  const mapStyle = useMapStyle();
  const { tripId, net, final, recorded } = useLocalSearchParams<{
    tripId: string;
    net?: string;
    final?: string;
    recorded?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [drop, setDrop] = useState<{ lat: number; lng: number } | null>(null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [baseFare, setBaseFare] = useState(0);
  const [distFare, setDistFare] = useState(0);
  const [timeFare, setTimeFare] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [tip, setTip] = useState(0);
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const netNum = Number(net ?? 0);
  const finalNum = Number(final ?? 0);

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from("trips")
      .select(
        "rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, base_fare, distance_fare, time_fare, platform_fee, final_fare"
      )
      .eq("id", tripId)
      .single();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setRiderId(data.rider_id as string);
    setPickup({ lat: Number(data.pickup_lat), lng: Number(data.pickup_lng) });
    setDrop({ lat: Number(data.dropoff_lat), lng: Number(data.dropoff_lng) });
    setBaseFare(Number(data.base_fare ?? 0));
    setDistFare(Number(data.distance_fare ?? 0));
    setTimeFare(Number(data.time_fare ?? 0));
    setPlatformFee(Number(data.platform_fee ?? 0));

    const route = await fetchRoutePolyline(
      Number(data.pickup_lat),
      Number(data.pickup_lng),
      Number(data.dropoff_lat),
      Number(data.dropoff_lng)
    );
    if (route?.coordinates?.length) setCoords(route.coordinates);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/(driver)/(tabs)/home" as Href);
        return true;
      });
      return () => sub.remove();
    }, [router])
  );

  async function submitRating() {
    if (!tripId || !riderId) return;
    if (stars < 1) {
      Alert.alert("Rating required", "Please give at least 1 star.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("trip_id", tripId)
        .eq("from_user_id", uid)
        .maybeSingle();
      if (existing) {
        router.replace("/(driver)/(tabs)/home" as Href);
        return;
      }
      const rateRes = await postTripRating({
        trip_id: tripId,
        to_user_id: riderId,
        rating: stars,
        comment: comment.trim() || null,
        tags: selectedTags.length ? selectedTags : null,
      });
      if (!rateRes.ok) throw new Error(rateRes.error ?? "Could not submit rating");
      if (tip > 0) {
        await supabase.from("trips").update({ rider_tip: tip }).eq("id", tripId);
      }
      router.replace("/(driver)/(tabs)/home" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function skipToHome() {
    router.replace("/(driver)/(tabs)/home" as Href);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#00D4AA" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {Platform.OS !== "web" && pickup && drop ? (
        <View className="h-52 w-full">
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            customMapStyle={mapStyle}
            initialRegion={{
              latitude: (pickup.lat + drop.lat) / 2,
              longitude: (pickup.lng + drop.lng) / 2,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            {coords.length > 1 ? <RoutePolyline coordinates={coords} /> : null}
            <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} />
            <Marker coordinate={{ latitude: drop.lat, longitude: drop.lng }} />
          </MapView>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-sora-display text-2xl font-bold text-text">Trip complete</Text>
        <Text className="font-inter mt-1 text-sm text-textSecondary">Great work — here is your summary.</Text>

        <View className="mt-6 rounded-2xl border border-border bg-surface2/80 p-4">
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Earnings</Text>
          <Row label="Base" value={`$${baseFare.toFixed(2)}`} />
          <Row label="Distance" value={`$${distFare.toFixed(2)}`} />
          <Row label="Time" value={`$${timeFare.toFixed(2)}`} />
          <Row label="Tip (from rider)" value={`$${tip.toFixed(2)}`} />
          <Row label="Platform fee" value={`-$${platformFee.toFixed(2)}`} />
          <View className="my-2 h-px bg-border" />
          <Row label="Net (this trip)" value={`$${netNum.toFixed(2)}`} bold />
          <Text className="font-inter mt-2 text-xs text-textSecondary">
            Rider paid ~${finalNum.toFixed(2)} fare before fees.
          </Text>
        </View>

        <Text className="font-inter mt-6 text-sm font-semibold text-text">Optional tip for rider story</Text>
        <View className="mt-2 flex-row gap-2">
          {[1, 2, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setTip(n)}
              className={`rounded-xl border px-4 py-2 ${tip === n ? "border-primary bg-primary/15" : "border-border"}`}
            >
              <Text className="font-inter text-sm text-text">${n}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setTip(0)} className="rounded-xl border border-border px-3 py-2">
            <Text className="font-inter text-sm text-text">None</Text>
          </Pressable>
        </View>

        {recorded === "1" ? (
          <View className="mt-4 rounded-xl border border-border bg-surface2/80 px-3 py-3">
            <Text className="font-inter text-sm text-text">
              Trip recording saved to your device. For safety review only — not accessible by the Lets Go team. We
              recommend keeping it for up to 7 days, then deleting it from your files app.
            </Text>
          </View>
        ) : null}

        <Text className="font-inter mt-6 text-sm font-semibold text-text">Rate rider</Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">Tap 1–5 stars</Text>
        <View className="mt-3">
          <RatingFormBlock
            mode="driver_rates_rider"
            showRatingLabel={false}
            stars={stars}
            onStarsChange={setStars}
            selectedTags={selectedTags}
            onToggleTag={(t) =>
              setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
            }
            comment={comment}
            onCommentChange={setComment}
          />
        </View>

        <View className="mt-6 gap-3">
          <Button title="Submit & back to home" loading={submitting} onPress={() => void submitRating()} />
          <Button title="Skip rating — go home" variant="ghost" onPress={skipToHome} disabled={submitting} />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="mt-2 flex-row justify-between">
      <Text className="font-inter text-sm text-textSecondary">{label}</Text>
      <Text className={`font-inter text-sm text-text ${bold ? "font-bold" : ""}`}>{value}</Text>
    </View>
  );
}
