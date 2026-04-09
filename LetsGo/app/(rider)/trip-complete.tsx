import type { Href } from "expo-router";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { CompletedTripFareBreakdown } from "@/components/rider/CompletedTripFareBreakdown";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { StarRatingPicker } from "@/components/shared/StarRatingPicker";
import { useStripe } from "@stripe/stripe-react-native";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { chargeRiderTip } from "@/lib/riderEdge";
import { isStripeConfigured } from "@/lib/stripeConfig";
import { supabase } from "@/lib/supabase";

const TAGS = ["Clean car", "Great chat", "On time", "Safe driver", "Quiet"];

export default function RiderTripCompleteScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuth();
  const { confirmPayment } = useStripe();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropLat, setDropLat] = useState<number | null>(null);
  const [dropLng, setDropLng] = useState<number | null>(null);
  const [fare, setFare] = useState(0);
  const [baseFare, setBaseFare] = useState<number | null>(null);
  const [distanceFare, setDistanceFare] = useState<number | null>(null);
  const [timeFare, setTimeFare] = useState<number | null>(null);
  const [platformFee, setPlatformFee] = useState<number | null>(null);
  const [surgeMult, setSurgeMult] = useState<number | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("Your driver");
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [tipDollars, setTipDollars] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "wallet" | null>(null);

  const load = useCallback(async () => {
    if (!tripId || !user?.id) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "rider_id, driver_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, estimated_fare, final_fare, base_fare, distance_fare, time_fare, platform_fee, surge_multiplier, rider_tip, trip_completed_at, payment_method"
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
    setPickupLat(data.pickup_lat != null ? Number(data.pickup_lat) : null);
    setPickupLng(data.pickup_lng != null ? Number(data.pickup_lng) : null);
    setDropLat(data.dropoff_lat != null ? Number(data.dropoff_lat) : null);
    setDropLng(data.dropoff_lng != null ? Number(data.dropoff_lng) : null);
    const paid =
      data.final_fare != null ? Number(data.final_fare) : Number(data.estimated_fare ?? 0);
    setFare(paid);
    setBaseFare(data.base_fare != null ? Number(data.base_fare) : null);
    setDistanceFare(data.distance_fare != null ? Number(data.distance_fare) : null);
    setTimeFare(data.time_fare != null ? Number(data.time_fare) : null);
    setPlatformFee(data.platform_fee != null ? Number(data.platform_fee) : null);
    setSurgeMult(data.surge_multiplier != null ? Number(data.surge_multiplier) : null);
    if (data.rider_tip != null) setTipDollars(Number(data.rider_tip));
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
    const pm = data.payment_method as string | null;
    if (pm === "card" || pm === "cash" || pm === "wallet") {
      setPaymentMethod(pm);
    } else {
      setPaymentMethod("card");
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
        Alert.alert("Rate your trip", "Give your driver a star rating before leaving this screen.");
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const effectiveTip = useMemo(() => {
    if (customMode) {
      const n = parseFloat(customTip.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
    return tipDollars;
  }, [customMode, customTip, tipDollars]);

  const chargedTotal = fare + effectiveTip;

  function setPresetTip(n: number) {
    setCustomMode(false);
    setCustomTip("");
    setTipDollars(n);
  }

  async function submitRating() {
    if (!tripId || !user?.id || !driverId) {
      router.replace("/(rider)/(tabs)/home" as Href);
      return;
    }
    if (stars < 1) {
      Alert.alert("Rate your trip", "Tap the stars to rate your driver (1–5) before continuing.");
      return;
    }
    setSubmitting(true);
    try {
      const tipCents = Math.round(effectiveTip * 100);

      if (
        effectiveTip > 0 &&
        paymentMethod === "card" &&
        isStripeConfigured() &&
        Platform.OS === "web"
      ) {
        Alert.alert(
          "Tip",
          "Paying a tip with your saved card is only supported in the iOS or Android app."
        );
        setSubmitting(false);
        return;
      }

      if (
        effectiveTip > 0 &&
        paymentMethod === "card" &&
        isStripeConfigured() &&
        Platform.OS !== "web"
      ) {
        if (tipCents < 50) {
          Alert.alert("Tip", "Tips charged to your card must be at least $0.50 AUD.");
          setSubmitting(false);
          return;
        }
        const tipRes = await chargeRiderTip({ trip_id: tripId, amount_cents: tipCents });
        if (tipRes.requires_action && tipRes.client_secret) {
          const { error: confirmErr } = await confirmPayment(tipRes.client_secret, {
            paymentMethodType: "Card",
          });
          if (confirmErr) throw new Error(confirmErr.message);
        } else if (!tipRes.ok) {
          throw new Error(tipRes.error ?? "Could not charge tip");
        }
      }

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
      const { error: tipErr } = await supabase
        .from("trips")
        .update({ rider_tip: effectiveTip })
        .eq("id", tripId)
        .eq("rider_id", user.id);
      if (tipErr) throw tipErr;

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
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function bookAgain() {
    router.replace("/(rider)/(tabs)/home" as Href);
  }

  const mapReady = Platform.OS !== "web" && pickupLat != null && pickupLng != null && dropLat != null && dropLng != null;

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
            <Button title="Back to home" onPress={bookAgain} />
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

        {mapReady ? (
          <View className="mt-4 h-40 overflow-hidden rounded-2xl border border-border">
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              customMapStyle={mapDarkStyle}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              initialRegion={{
                latitude: (pickupLat! + dropLat!) / 2,
                longitude: (pickupLng! + dropLng!) / 2,
                latitudeDelta: Math.abs(pickupLat! - dropLat!) * 1.8 + 0.02,
                longitudeDelta: Math.abs(pickupLng! - dropLng!) * 1.8 + 0.02,
              }}
            >
              <Marker coordinate={{ latitude: pickupLat!, longitude: pickupLng! }} pinColor="#3B82F6" />
              <Marker coordinate={{ latitude: dropLat!, longitude: dropLng! }} pinColor="#F97316" />
            </MapView>
          </View>
        ) : null}

        <View className="mt-4">
          <CompletedTripFareBreakdown
            baseFare={baseFare}
            distanceFare={distanceFare}
            timeFare={timeFare}
            platformFee={platformFee}
            surgeMultiplier={surgeMult}
            chargedTotal={chargedTotal}
          />
        </View>

        <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Driver</Text>
        <Text className="font-inter mt-1 text-base text-text">{driverName}</Text>
        <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Pickup</Text>
        <Text className="font-inter mt-1 text-sm text-textSecondary">{pickupAddress}</Text>
        <Text className="font-inter mt-4 text-xs font-semibold uppercase text-textSecondary">Drop-off</Text>
        <Text className="font-inter mt-1 text-sm text-textSecondary">{dropoffAddress}</Text>

        <Text className="font-inter mt-8 text-sm font-semibold text-text">Tip your driver</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[1, 2, 5].map((n) => {
            const on = !customMode && tipDollars === n;
            return (
              <Pressable
                key={n}
                onPress={() => setPresetTip(n)}
                className={`rounded-full border px-4 py-2 ${on ? "border-primary bg-primary/15" : "border-border"}`}
              >
                <Text className="font-inter text-sm text-text">${n}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              setCustomMode(true);
              setTipDollars(0);
            }}
            className={`rounded-full border px-4 py-2 ${customMode ? "border-primary bg-primary/15" : "border-border"}`}
          >
            <Text className="font-inter text-sm text-text">Custom</Text>
          </Pressable>
        </View>
        {customMode ? (
          <TextInput
            value={customTip}
            onChangeText={setCustomTip}
            keyboardType="decimal-pad"
            placeholder="Amount (AUD)"
            placeholderTextColor="#5C6678"
            className="font-inter mt-3 rounded-xl border border-border bg-surface2 px-3 py-3 text-sm text-text"
          />
        ) : null}

        <Text className="font-inter mt-8 text-sm font-semibold text-text">How was your driver?</Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">Rating required</Text>
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
          <Button
            title="Submit rating & Book again"
            loading={submitting}
            onPress={() => void submitRating()}
          />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
