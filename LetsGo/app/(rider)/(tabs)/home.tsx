import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { DestinationSearch } from "@/components/rider/DestinationSearch";
import { DriverMarker } from "@/components/rider/DriverMarker";
import {
  RiderBookingPaymentBlock,
  type PayMode,
  type RiderBookingPaymentHandle,
} from "@/components/rider/RiderBookingPaymentBlock";
import { RideOptionsSheet } from "@/components/rider/RideOptionsSheet";
import { RoutePolyline } from "@/components/rider/RoutePolyline";
import { SchedulePicker } from "@/components/rider/SchedulePicker";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNearbyDrivers } from "@/hooks/useNearbyDrivers";
import { useProfile } from "@/hooks/useProfile";
import { useRiderMapLocation } from "@/hooks/useRiderMapLocation";
import type { FareEstimateOption, ResolvedPlace, RideType } from "@/lib/bookingTypes";
import { fetchRoutePolyline } from "@/lib/googleDirections";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import { createTrip, getFareEstimate } from "@/lib/riderEdge";
import { allowCashBookingDemo, isStripeConfigured } from "@/lib/stripeConfig";
import { supabase } from "@/lib/supabase";

type Phase = "idle" | "destination" | "ride_options";

export default function RiderHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const fareEstimateSeq = useRef(0);

  const snapPoints = useMemo(() => ["16%", "28%", "78%"], []);

  const resumeActiveTrip = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("trips")
      .select("id, status")
      .eq("rider_id", user.id)
      .in("status", ["searching", "driver_accepted", "driver_arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    if (data.status === "in_progress") {
      router.replace(`/(rider)/trip-live?tripId=${data.id}` as Href);
      return;
    }
    if (data.status === "driver_accepted" || data.status === "driver_arrived") {
      router.replace(`/(rider)/trip-awaiting-pickup?tripId=${encodeURIComponent(data.id)}` as Href);
      return;
    }
    router.replace(`/(rider)/searching?tripId=${encodeURIComponent(data.id)}` as Href);
  }, [user?.id, router]);

  useFocusEffect(
    useCallback(() => {
      void resumeActiveTrip();
    }, [resumeActiveTrip])
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const { userCoord, region, setRegion, locationError, recenterMapToUser } = useRiderMapLocation({
    watch: true,
    timeIntervalMs: 4000,
    distanceIntervalM: 10,
  });
  const [pickup, setPickup] = useState<ResolvedPlace | null>(null);
  const [dropoff, setDropoff] = useState<ResolvedPlace | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [fareOptions, setFareOptions] = useState<FareEstimateOption[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | undefined>();
  const [durationMin, setDurationMin] = useState<number | undefined>();
  const [surgeActive, setSurgeActive] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1);
  const [selectedRideType, setSelectedRideType] = useState<RideType>("economy");
  const [notes, setNotes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [, setPromotion] = useState<{
    id: string;
    code: string;
    discountLabel: string;
  } | null>(null);
  const [booking, setBooking] = useState(false);
  const paymentRef = useRef<RiderBookingPaymentHandle>(null);
  const [payMode, setPayMode] = useState<PayMode>(() =>
    allowCashBookingDemo() && !isStripeConfigured() ? "cash" : "card"
  );
  const [paymentReady, setPaymentReady] = useState(true);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (isWeb) {
      if (allowCashBookingDemo()) setPayMode("cash");
      setPaymentReady(allowCashBookingDemo());
    }
  }, [isWeb]);

  const surgePulse = useSharedValue(1);
  useEffect(() => {
    if (!surgeActive) return;
    surgePulse.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      true
    );
  }, [surgeActive, surgePulse]);

  const surgeBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: surgePulse.value }],
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={1} appearsOnIndex={2} opacity={0.45} />
    ),
    []
  );

  useEffect(() => {
    if (!userCoord) return;
    setPickup((p) => {
      if (p && p.description !== "Current location") return p;
      return {
        description: "Current location",
        lat: userCoord.lat,
        lng: userCoord.lng,
      };
    });
  }, [userCoord?.lat, userCoord?.lng]);

  const pollLat = pickup?.lat ?? userCoord?.lat;
  const pollLng = pickup?.lng ?? userCoord?.lng;
  const { drivers } = useNearbyDrivers({
    pickupLat: pollLat,
    pickupLng: pollLng,
    rideType: phase === "ride_options" ? selectedRideType : "economy",
    enabled: phase === "idle" || phase === "ride_options",
    radiusKm: 5,
    intervalMs: 10_000,
  });

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRouteCoords([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const route = await fetchRoutePolyline(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
      if (!cancelled && route?.coordinates?.length) setRouteCoords(route.coordinates);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setFareOptions([]);
      setEstimateError(null);
      setEstimateLoading(false);
      return;
    }
    const seq = ++fareEstimateSeq.current;
    setEstimateLoading(true);
    setEstimateError(null);
    void (async () => {
      try {
        const res = await getFareEstimate({
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
        });
        if (seq !== fareEstimateSeq.current) return;
        if (!res.ok || !res.options?.length) {
          setEstimateError(res.error ?? "Could not estimate fare.");
          setFareOptions([]);
          return;
        }
        setFareOptions(res.options);
        setDistanceKm(res.distance_km);
        setDurationMin(res.duration_min);
        setSurgeActive(Boolean(res.surge_active));
        setSurgeMultiplier(res.surge_multiplier ?? 1);
      } catch (e) {
        if (seq !== fareEstimateSeq.current) return;
        setEstimateError(e instanceof Error ? e.message : "Estimate failed.");
      } finally {
        if (seq === fareEstimateSeq.current) {
          setEstimateLoading(false);
        }
      }
    })();
    return () => {
      fareEstimateSeq.current += 1;
      setEstimateLoading(false);
    };
  }, [pickup, dropoff]);

  useEffect(() => {
    if (phase === "ride_options") {
      sheetRef.current?.snapToIndex(2);
    } else if (phase === "idle") {
      sheetRef.current?.snapToIndex(0);
    }
  }, [phase]);

  useEffect(() => {
    if (pickup && dropoff && routeCoords.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: dropoff.lat, longitude: dropoff.lng },
          ...routeCoords,
        ],
        {
          edgePadding: { top: 120, right: 48, bottom: 280, left: 48 },
          animated: true,
        }
      );
    }
  }, [pickup, dropoff, routeCoords]);

  function onConfirmRoute(p: ResolvedPlace, d: ResolvedPlace) {
    setPickup(p);
    setDropoff(d);
    setPhase("ride_options");
    setDestinationOpen(false);
  }

  const [destinationOpen, setDestinationOpen] = useState(false);

  const selectedOption =
    fareOptions.find((o) => o.ride_type === selectedRideType) ?? fareOptions[0];

  const bookPaymentBlocked =
    phase === "ride_options" &&
    (isWeb ? !allowCashBookingDemo() : !paymentReady);

  const scheduledLabel =
    scheduledFor != null
      ? scheduledFor.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  async function onBook() {
    if (!pickup || !dropoff || !selectedOption || !user?.id) return;
    if (isWeb && !allowCashBookingDemo()) {
      setEstimateError("Use the iOS or Android app for card bookings with Stripe.");
      return;
    }
    setBooking(true);
    try {
      let stripe_payment_intent_id: string | undefined;
      let payment_method: "card" | "cash" = "card";

      if (isWeb || payMode === "cash") {
        if (!allowCashBookingDemo()) {
          throw new Error("Enable EXPO_PUBLIC_ALLOW_CASH_BOOKING=true for cash demo, or use a card on mobile.");
        }
        payment_method = "cash";
      } else {
        const auth = await paymentRef.current?.authorizeForBooking();
        if (!auth?.stripe_payment_intent_id) {
          throw new Error("Could not authorise payment.");
        }
        stripe_payment_intent_id = auth.stripe_payment_intent_id;
      }

      const tripPayload = {
        ride_type: selectedRideType,
        pickup_address: pickup.description,
        dropoff_address: dropoff.description,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        estimated_distance_km: distanceKm ?? null,
        estimated_duration_min: durationMin ?? null,
        estimated_fare: selectedOption.estimated_fare,
        surge_multiplier: surgeMultiplier,
        base_fare: selectedOption.base_fare,
        distance_fare: selectedOption.distance_fare,
        time_fare: selectedOption.time_fare,
        platform_fee: selectedOption.platform_fee,
        notes: notes.trim() || null,
        scheduled_for:
          scheduleEnabled && scheduledFor ? scheduledFor.toISOString() : null,
        payment_method,
        ...(stripe_payment_intent_id ? { stripe_payment_intent_id } : {}),
      };
      const res = await createTrip(tripPayload);
      if (!res.ok || !res.trip_id) {
        throw new Error(res.error ?? "Could not create trip.");
      }
      if (res.status === "no_driver_found") {
        setEstimateError(
          "No drivers are available near this pickup right now. Try again in a few minutes, move the pin closer to a busy area, or check that drivers are online."
        );
        return;
      }
      router.push(`/(rider)/searching?tripId=${encodeURIComponent(res.trip_id)}` as Href);
    } catch (e) {
      setEstimateError(e instanceof Error ? e.message : "Booking failed.");
    } finally {
      setBooking(false);
    }
  }

  const mapReady = Platform.OS !== "web";

  return (
    <View className="flex-1 bg-background">
      {mapReady ? (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapDarkStyle}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {userCoord ? (
            <Marker
              coordinate={{ latitude: userCoord.lat, longitude: userCoord.lng }}
              title="You are here"
              pinColor="#00D4AA"
            />
          ) : null}
          {pickup ? (
            <Marker
              coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
              title="Pickup"
              pinColor="#3B82F6"
            />
          ) : null}
          {dropoff ? (
            <Marker
              coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
              title="Drop-off"
              pinColor="#F97316"
            />
          ) : null}
          {routeCoords.length > 1 ? <RoutePolyline coordinates={routeCoords} /> : null}
          {drivers.map((d) => (
            <DriverMarker
              key={d.driver_id}
              driverId={d.driver_id}
              latitude={d.current_lat}
              longitude={d.current_lng}
            />
          ))}
        </MapView>
      ) : (
        <View className="flex-1 items-center justify-center bg-surface px-8">
          <Text className="font-sora text-center text-lg text-text">Map is available on iOS and Android.</Text>
          <Text className="font-inter mt-2 text-center text-sm text-textSecondary">
            Use the Expo Go app or a dev build to see the full map experience.
          </Text>
        </View>
      )}

      {surgeActive && phase === "ride_options" ? (
        <Animated.View
          style={[
            surgeBadgeStyle,
            {
              position: "absolute",
              top: insets.top + 56,
              alignSelf: "center",
            },
          ]}
          className="rounded-full bg-orange-500/90 px-4 py-2"
        >
          <Text className="font-inter text-xs font-bold text-white">
            {surgeMultiplier.toFixed(1)}× surge in this area
          </Text>
        </Animated.View>
      ) : null}

      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}
        pointerEvents="box-none"
      >
        <View className="max-w-[70%] rounded-2xl border border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
          <Text className="font-inter text-xs text-textSecondary">Hello,</Text>
          <Text className="font-sora text-lg font-semibold text-text" numberOfLines={1}>
            {profile?.full_name ?? "Rider"}
          </Text>
        </View>
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={48} />
      </View>

      {locationError ? (
        <View className="absolute bottom-40 left-4 right-4 rounded-xl bg-error/20 p-3">
          <Text className="font-inter text-center text-xs text-error">{locationError}</Text>
        </View>
      ) : null}

      {mapReady && userCoord ? (
        <Pressable
          accessibilityLabel="Center map on my location"
          onPress={() => recenterMapToUser(mapRef)}
          className="absolute right-4 h-12 w-12 items-center justify-center rounded-full border border-border bg-background/90 shadow-lg"
          style={{ bottom: insets.bottom + 200 }}
        >
          <Ionicons name="locate" size={22} color="#00D4AA" />
        </Pressable>
      ) : null}

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{
          backgroundColor: "rgba(19, 25, 41, 0.94)",
          borderWidth: 1,
          borderColor: "rgba(30, 45, 69, 0.9)",
        }}
        handleIndicatorStyle={{ backgroundColor: "#5C6678" }}
        backdropComponent={phase === "ride_options" ? renderBackdrop : undefined}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {phase === "idle" || phase === "destination" ? (
            <View className="pt-2">
              <Text className="font-sora text-lg font-semibold text-text">Where to?</Text>
              <Pressable
                onPress={() => {
                  setDestinationOpen(true);
                  setPhase("destination");
                }}
                className="mt-4 flex-row items-center rounded-2xl border border-border bg-surface2/90 px-4 py-4 active:opacity-90"
              >
                <Ionicons name="search" size={20} color="#8A94A6" />
                <Text className="font-inter ml-3 flex-1 text-base text-textSecondary">
                  Search destination
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#5C6678" />
              </Pressable>
              {dropoff ? (
                <Text className="font-inter mt-3 text-xs text-textSecondary" numberOfLines={2}>
                  To: {dropoff.description}
                </Text>
              ) : null}
            </View>
          ) : null}

          {phase === "ride_options" ? (
            <View className="pt-1">
              <Pressable
                onPress={() => {
                  setDestinationOpen(true);
                  setPhase("destination");
                }}
                className="mb-4 flex-row items-center rounded-xl border border-border/80 bg-background/50 px-3 py-2 active:opacity-80"
              >
                <Ionicons name="location" size={16} color="#00D4AA" />
                <Text className="font-inter ml-2 flex-1 text-xs text-textSecondary" numberOfLines={2}>
                  {pickup?.description} → {dropoff?.description}
                </Text>
                <Text className="font-inter text-xs text-primary">Edit</Text>
              </Pressable>

              {estimateLoading ? (
                <View className="items-center py-10">
                  <ActivityIndicator color="#00D4AA" />
                  <Text className="font-inter mt-3 text-sm text-textSecondary">Calculating fares…</Text>
                </View>
              ) : estimateError ? (
                <Text className="font-inter py-4 text-center text-sm text-error">{estimateError}</Text>
              ) : (
                <>
                  {selectedOption ? (
                    isWeb ? (
                      <View className="mb-4 rounded-xl border border-border/60 bg-surface2/50 px-3 py-3">
                        <Text className="font-inter text-xs text-textSecondary">
                          {allowCashBookingDemo()
                            ? "Web: cash demo only. Use the mobile app for Stripe card bookings."
                            : "Open Lets Go on iOS or Android to book with a saved card."}
                        </Text>
                      </View>
                    ) : (
                      <RiderBookingPaymentBlock
                        ref={paymentRef}
                        fareAud={selectedOption.estimated_fare}
                        payMode={payMode}
                        onPayModeChange={setPayMode}
                        onReadinessChange={setPaymentReady}
                      />
                    )
                  ) : null}
                  <RideOptionsSheet
                    surgeActive={surgeActive}
                    surgeMultiplier={surgeMultiplier}
                    options={fareOptions}
                    distanceKm={distanceKm}
                    durationMin={durationMin}
                    selectedRideType={selectedRideType}
                    onSelectRideType={setSelectedRideType}
                    notes={notes}
                    onNotesChange={setNotes}
                    scheduleEnabled={scheduleEnabled}
                    onScheduleEnabledChange={(v) => {
                      setScheduleEnabled(v);
                      if (!v) setScheduledFor(null);
                    }}
                    onOpenSchedule={() => setScheduleModal(true)}
                    scheduledLabel={scheduledLabel}
                    onPromotionResolved={setPromotion}
                    booking={booking}
                    bookDisabled={bookPaymentBlocked}
                    onBook={() => void onBook()}
                  />
                </>
              )}
            </View>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheet>

      <DestinationSearch
        visible={destinationOpen}
        onClose={() => {
          setDestinationOpen(false);
          if (!dropoff) setPhase("idle");
          else setPhase("ride_options");
        }}
        initialPickup={pickup}
        initialDropoff={dropoff}
        onConfirm={onConfirmRoute}
        userLocation={userCoord}
      />

      <SchedulePicker
        visible={scheduleModal}
        value={scheduledFor}
        onChange={(d) => {
          setScheduledFor(d);
          setScheduleEnabled(d != null);
        }}
        onClose={() => setScheduleModal(false)}
      />

      {booking ? (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <View className="rounded-2xl bg-surface px-8 py-6">
            <ActivityIndicator size="large" color="#00D4AA" />
            <Text className="font-inter mt-4 text-center text-sm text-text">Booking your ride…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
