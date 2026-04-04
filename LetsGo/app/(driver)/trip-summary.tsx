import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { supabase } from "@/lib/supabase";

const TAGS = ["On time", "Polite", "Clear directions", "Respectful", "Quiet"];

export default function TripSummaryScreen() {
  const { tripId, net, final } = useLocalSearchParams<{
    tripId: string;
    net?: string;
    final?: string;
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
      const { error } = await supabase.from("ratings").insert({
        trip_id: tripId,
        from_user_id: uid,
        to_user_id: riderId,
        rating: stars,
        comment: comment.trim() || null,
        tags: selectedTags.length ? selectedTags : null,
      });
      if (error) throw error;
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
            customMapStyle={mapDarkStyle}
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

      <View className="flex-1 px-5 pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
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

        <Text className="font-inter mt-6 text-sm font-semibold text-text">Rate rider</Text>
        <View className="mt-2 flex-row gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)}>
              <Text className="text-3xl">{n <= stars ? "★" : "☆"}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = selectedTags.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() =>
                  setSelectedTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                }
                className={`rounded-full border px-3 py-1.5 ${on ? "border-primary bg-primary/15" : "border-border"}`}
              >
                <Text className="font-inter text-xs text-text">{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Comment (optional)"
          placeholderTextColor="#5C6678"
          multiline
          className="font-inter mt-4 min-h-[72px] rounded-xl border border-border bg-surface2 p-3 text-sm text-text"
        />

        <View className="mt-6">
          <Button title="Submit & back to home" loading={submitting} onPress={() => void submitRating()} />
        </View>
      </View>
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
