import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ResolvedPlace } from "@/lib/bookingTypes";
import { getGoogleMapsApiKey } from "@/lib/mapsConfig";
import { Button } from "@/components/ui/Button";

const RECENT_KEY = "letsgo_recent_places_v1";

type RecentEntry = ResolvedPlace & { description: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  initialPickup: ResolvedPlace | null;
  initialDropoff: ResolvedPlace | null;
  onConfirm: (pickup: ResolvedPlace, dropoff: ResolvedPlace) => void;
};

type Prediction = { id: string; description: string; main: string; secondary: string };

export function DestinationSearch({
  visible,
  onClose,
  initialPickup,
  initialDropoff,
  onConfirm,
}: Props) {
  const [focus, setFocus] = useState<"pickup" | "dropoff">("dropoff");
  const [pickupQ, setPickupQ] = useState(initialPickup?.description ?? "");
  const [dropQ, setDropQ] = useState(initialDropoff?.description ?? "");
  const [pickupPlace, setPickupPlace] = useState<ResolvedPlace | null>(initialPickup);
  const [dropPlace, setDropPlace] = useState<ResolvedPlace | null>(initialDropoff);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const key = getGoogleMapsApiKey();

  useEffect(() => {
    if (!visible) return;
    void AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as RecentEntry[];
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, 8));
      } catch {
        /* ignore */
      }
    });
  }, [visible]);

  const saveRecent = useCallback(async (p: ResolvedPlace) => {
    const entry: RecentEntry = { ...p, description: p.description };
    const next = [entry, ...recent.filter((r) => r.description !== entry.description)].slice(0, 8);
    setRecent(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [recent]);

  async function fetchPredictions(input: string) {
    if (!key || input.trim().length < 2) {
      setPreds([]);
      return;
    }
    setLoadingPreds(true);
    setError(null);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input.trim())}` +
        `&key=${key}&components=country:au&types=address`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        predictions?: {
          place_id: string;
          description: string;
          structured_formatting?: { main_text: string; secondary_text: string };
        }[];
        error_message?: string;
      };
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(data.error_message || data.status);
      }
      const list =
        data.predictions?.map((p) => ({
          id: p.place_id,
          description: p.description,
          main: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
        })) ?? [];
      setPreds(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Places search failed");
      setPreds([]);
    } finally {
      setLoadingPreds(false);
    }
  }

  async function resolvePlace(pred: Prediction): Promise<ResolvedPlace | null> {
    if (!key) return null;
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(pred.id)}` +
      `&fields=geometry,formatted_address,name&key=${key}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      result?: {
        formatted_address?: string;
        name?: string;
        geometry?: { location: { lat: number; lng: number } };
      };
    };
    if (data.status !== "OK" || !data.result?.geometry?.location) return null;
    const loc = data.result.geometry.location;
    return {
      description: pred.description,
      lat: loc.lat,
      lng: loc.lng,
    };
  }

  async function onPickPrediction(pred: Prediction) {
    setResolving(true);
    setError(null);
    try {
      const resolved = await resolvePlace(pred);
      if (!resolved) {
        setError("Could not load that place.");
        return;
      }
      if (focus === "pickup") {
        setPickupPlace(resolved);
        setPickupQ(resolved.description);
      } else {
        setDropPlace(resolved);
        setDropQ(resolved.description);
      }
      setPreds([]);
    } finally {
      setResolving(false);
    }
  }

  function onPickRecent(entry: RecentEntry) {
    if (focus === "pickup") {
      setPickupPlace(entry);
      setPickupQ(entry.description);
    } else {
      setDropPlace(entry);
      setDropQ(entry.description);
    }
    setPreds([]);
  }

  async function confirm() {
    if (!pickupPlace || !dropPlace) {
      setError("Select both pickup and destination on the map or from search.");
      return;
    }
    await saveRecent(dropPlace);
    onConfirm(pickupPlace, dropPlace);
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable onPress={onClose} hitSlop={12} className="p-2">
            <Ionicons name="close" size={24} color="#E8ECF2" />
          </Pressable>
          <Text className="font-sora text-base font-semibold text-text">Trip route</Text>
          <View className="w-10" />
        </View>

        {!key ? (
          <View className="flex-1 justify-center px-6">
            <Text className="font-inter text-center text-sm text-error">
              Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to use address search.
            </Text>
          </View>
        ) : (
          <>
            <View className="px-4 pt-4">
              <Text className="font-inter mb-1 text-xs font-semibold uppercase text-textSecondary">
                Pickup
              </Text>
              <Pressable onPress={() => setFocus("pickup")}>
                <TextInput
                  value={pickupQ}
                  onChangeText={(t) => {
                    setPickupQ(t);
                    setPickupPlace(null);
                    void fetchPredictions(t);
                  }}
                  onFocus={() => setFocus("pickup")}
                  placeholder="Pickup address"
                  placeholderTextColor="#5C6678"
                  className={`font-inter h-12 rounded-xl border px-4 text-sm text-text ${
                    focus === "pickup" ? "border-primary" : "border-border"
                  } bg-surface2`}
                />
              </Pressable>
              <Text className="font-inter mb-1 mt-4 text-xs font-semibold uppercase text-textSecondary">
                Where to?
              </Text>
              <Pressable onPress={() => setFocus("dropoff")}>
                <TextInput
                  value={dropQ}
                  onChangeText={(t) => {
                    setDropQ(t);
                    setDropPlace(null);
                    void fetchPredictions(t);
                  }}
                  onFocus={() => setFocus("dropoff")}
                  placeholder="Search destination"
                  placeholderTextColor="#5C6678"
                  className={`font-inter h-12 rounded-xl border px-4 text-sm text-text ${
                    focus === "dropoff" ? "border-primary" : "border-border"
                  } bg-surface2`}
                />
              </Pressable>
            </View>

            {recent.length > 0 && preds.length === 0 && !loadingPreds ? (
              <View className="mt-4 px-4">
                <Text className="font-inter mb-2 text-xs font-semibold uppercase text-textSecondary">
                  Recent
                </Text>
                {recent.map((r) => (
                  <Pressable
                    key={r.description}
                    onPress={() => onPickRecent(r)}
                    className="border-b border-border/60 py-3 active:bg-surface2"
                  >
                    <Text className="font-inter text-sm text-text">{r.description}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {loadingPreds ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#00D4AA" />
              </View>
            ) : (
              <FlatList
                data={preds}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => void onPickPrediction(item)}
                    className="border-b border-border/60 py-3 active:bg-surface2"
                  >
                    <Text className="font-inter text-sm font-medium text-text">{item.main}</Text>
                    <Text className="font-inter mt-0.5 text-xs text-textSecondary">{item.secondary}</Text>
                  </Pressable>
                )}
              />
            )}

            {error ? (
              <Text className="font-inter px-4 text-center text-sm text-error">{error}</Text>
            ) : null}

            <View className="mt-auto border-t border-border px-4 py-4">
              <Button
                title="Confirm route"
                loading={resolving}
                disabled={!pickupPlace || !dropPlace}
                onPress={() => void confirm()}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
