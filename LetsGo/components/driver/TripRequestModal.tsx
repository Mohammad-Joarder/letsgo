import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mapDarkStyle } from "@/lib/mapDarkStyle";
import type { TripOfferPayload } from "@/lib/driverTypes";

type Props = {
  visible: boolean;
  offer: TripOfferPayload | null;
  loading: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Stable identity for the countdown effect: parent may pass a new `offer` object reference
 * for the same trip (hydration), which must not reset the 15s timer.
 */
function offerTimerKey(offer: TripOfferPayload | null): string | null {
  if (!offer?.trip_id) return null;
  return `${offer.trip_id}:${offer.offer_expires_at}`;
}

export function TripRequestModal({ visible, offer, loading, onAccept, onDecline }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(15);
  const timedOutRef = useRef(false);
  const onAcceptRef = useRef(onAccept);
  const onDeclineRef = useRef(onDecline);
  const offerRef = useRef(offer);
  onAcceptRef.current = onAccept;
  onDeclineRef.current = onDecline;
  offerRef.current = offer;

  const timerKey = offerTimerKey(offer);

  useEffect(() => {
    if (!visible || !timerKey) {
      setSecondsLeft(15);
      timedOutRef.current = false;
      return;
    }

    timedOutRef.current = false;

    const expires = new Date(offerRef.current!.offer_expires_at).getTime();
    const tick = () => {
      const msLeft = Math.max(0, expires - Date.now());
      const s = Math.ceil(msLeft / 1000);
      setSecondsLeft(s);
      if (msLeft <= 0 && !timedOutRef.current) {
        timedOutRef.current = true;
        onDeclineRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [visible, timerKey]);

  const rideLabel = useMemo(() => {
    if (!offer) return "";
    return offer.ride_type.charAt(0).toUpperCase() + offer.ride_type.slice(1);
  }, [offer]);

  const distLabel = useMemo(() => {
    if (!offer?.estimated_distance_km) return "—";
    return `${Number(offer.estimated_distance_km).toFixed(1)} km`;
  }, [offer]);

  const progress = offer ? Math.min(1, secondsLeft / 15) : 0;

  if (!offer) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <View className="flex-1 bg-background px-5 pt-14 pb-8">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-sora text-xl font-bold text-text">New trip request</Text>
          <Pressable onPress={() => onDeclineRef.current()} hitSlop={12} disabled={loading}>
            <Text className="font-inter text-sm text-textSecondary">Decline</Text>
          </Pressable>
        </View>

        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-surface2">
            <Ionicons name="person" size={28} color="#00D4AA" />
          </View>
          <View className="flex-1">
            <Text className="font-sora text-lg font-semibold text-text">{offer.rider_name}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text className="font-inter text-sm text-textSecondary">
                {Number(offer.rider_rating).toFixed(1)} ★
              </Text>
              {offer.rider_verified ? <Badge label="Verified" tone="success" /> : null}
            </View>
          </View>
          <Badge label={rideLabel} tone="default" />
        </View>

        <View className="mb-4 rounded-2xl border border-border bg-surface2/80 p-4">
          <Row icon="navigate" label="Pickup" value={offer.pickup_address} />
          <View className="my-3 h-px bg-border" />
          <Row icon="flag" label="Drop-off" value={offer.dropoff_address} />
          <Text className="font-inter mt-3 text-xs text-textSecondary">
            Est. trip distance: {distLabel}
          </Text>
        </View>

        <View className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-inter text-xs text-textSecondary">Est. net earnings</Text>
              <Text className="font-sora text-2xl font-bold text-primary">
                ${Number(offer.estimated_net_earnings).toFixed(2)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-sora text-3xl font-bold text-text">{secondsLeft}</Text>
              <Text className="font-inter text-xs text-textSecondary">seconds left</Text>
            </View>
          </View>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>

        {Platform.OS !== "web" ? (
          <View className="mb-6 h-36 overflow-hidden rounded-2xl border border-border">
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              customMapStyle={mapDarkStyle}
              initialRegion={{
                latitude: offer.pickup_lat,
                longitude: offer.pickup_lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={{ latitude: offer.pickup_lat, longitude: offer.pickup_lng }} />
            </MapView>
          </View>
        ) : null}

        <View className="mt-auto gap-3">
          <Button title="ACCEPT" loading={loading} onPress={() => onAcceptRef.current()} />
          <Pressable onPress={() => onDeclineRef.current()} disabled={loading} className="items-center py-2">
            <Text className="font-inter text-sm font-semibold text-textSecondary">DECLINE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row gap-3">
      <Ionicons name={icon} size={18} color="#8A94A6" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">{label}</Text>
        <Text className="font-inter mt-1 text-sm leading-5 text-text">{value}</Text>
      </View>
    </View>
  );
}
