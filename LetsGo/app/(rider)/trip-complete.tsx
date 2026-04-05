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
  TextInput,
  View,
} from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { StarRatingPicker } from "@/components/shared/StarRatingPicker";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const TAGS = ["Smooth ride", "Safe driving", "Friendly", "On time", "Clean car"];

export default function RiderTripCompleteScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [fare, setFare] = useState(0);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("Your driver");
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "rider_id, driver_id, status, pickup_address, dropoff_address, estimated_fare, final_fare, trip_completed_at"
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
    if (data.status !== "completed") {
      setError("This trip is not finished yet.");
      setLoading(false);
      return;
    }
    setPickupAddress(String(data.pickup_address ?? ""));
    setDropoffAddress(String(data.dropoff_address ?? ""));
    const paid =
      data.final_fare != null ? Number(data.final_fare) : Number(data.estimated_fare ?? 0);
    setFare(paid);
    const did = data.driver_id as string | null;
    setDriverId(did);
    if (did) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", did)
        .maybeSingle();
      setDriverName(prof?.full_name ?? "Your driver");
    }
    setError(null);
    setLoading(false);
  }, [tripId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/(rider)/(tabs)/home" as Href);
        return true;
      });
      return () => sub.remove();
    }, [router])
  );

  async function submitRating() {
    if (!tripId || !user?.id || !driverId) {
      router.replace("/(rider)/(tabs)/home" as Href);
      return;
    }
    if (stars < 1) {
      Alert.alert("Rate your trip", "Tap the stars to rate your driver (1–5).");
      return;
    }
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("trip_id", tripId)
        .eq("from_user_id", user.id)
        .maybeSingle();
      if (existing) {
        router.replace("/(rider)/(tabs)/home" as Href);
        return;
      }
      const { error: insErr } = await supabase.from("ratings").insert({
        trip_id: tripId,
        from_user_id: user.id,
        to_user_id: driverId,
        rating: stars,
        comment: comment.trim() || null,
        tags: selectedTags.length ? selectedTags : null,
      });
      if (insErr) throw insErr;
      const { error: tripErr } = await supabase
        .from("trips")
        .update({ driver_rating: stars })
        .eq("id", tripId)
        .eq("rider_id", user.id);
      if (tripErr) throw tripErr;
      router.replace("/(rider)/(tabs)/home" as Href);
    } catch (e) {
      Alert.alert("Could not save rating", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function skipToHome() {
    router.replace("/(rider)/(tabs)/home" as Href);
  }

  if (loading) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="font-inter text-center text-error">{error}</Text>
          <View className="mt-6 w-full max-w-sm">
            <Button title="Back to home" onPress={skipToHome} />
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        className="flex-1 bg-background px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-sora-display text-2xl font-bold text-text">Trip complete</Text>
        <Text className="font-inter mt-1 text-sm text-textSecondary">Thanks for riding with Lets Go.</Text>

        <View className="mt-6 rounded-2xl border border-border bg-surface2/80 p-4">
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Paid</Text>
          <Text className="font-sora mt-1 text-2xl font-bold text-text">${fare.toFixed(2)}</Text>
          <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Driver</Text>
          <Text className="font-inter mt-1 text-base text-text">{driverName}</Text>
          <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Pickup</Text>
          <Text className="font-inter mt-1 text-sm text-textSecondary">{pickupAddress}</Text>
          <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Drop-off</Text>
          <Text className="font-inter mt-1 text-sm text-textSecondary">{dropoffAddress}</Text>
        </View>

        <Text className="font-inter mt-8 text-sm font-semibold text-text">How was your driver?</Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">Tap 1–5 stars</Text>
        <View className="mt-3">
          <StarRatingPicker value={stars} onChange={setStars} size={44} />
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
          className="font-inter mt-4 min-h-[80px] rounded-xl border border-border bg-surface2 p-3 text-sm text-text"
        />

        <View className="mt-8 gap-3">
          <Button title="Submit rating & done" loading={submitting} onPress={() => void submitRating()} />
          <Button title="Skip for now" variant="ghost" onPress={skipToHome} />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
