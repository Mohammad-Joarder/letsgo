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
import {
  geocodeQueryToPlaces,
  looksLikeNumericPostcodeQuery,
  reverseGeocodeLabel,
} from "@/lib/googleGeocoding";
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
  /** Biases search & geocode toward this point (user GPS). */
  userLocation?: { lat: number; lng: number } | null;
};

type Prediction = {
  id: string;
  description: string;
  main: string;
  secondary: string;
  /** When set, selection skips Place Details (e.g. geocoded postcode). */
  resolved?: ResolvedPlace;
};

export function DestinationSearch({
  visible,
  onClose,
  initialPickup,
  initialDropoff,
  onConfirm,
  userLocation,
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
    setPickupQ(initialPickup?.description ?? "");
    setDropQ(initialDropoff?.description ?? "");
    setPickupPlace(initialPickup);
    setDropPlace(initialDropoff);
    setFocus("dropoff");
    setPreds([]);
    setError(null);
  }, [visible, initialPickup, initialDropoff]);

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
    setRecent((prev) => {
      const next = [entry, ...prev.filter((r) => r.description !== entry.description)].slice(0, 8);
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchPredictions = useCallback(
    async (input: string) => {
      const q = input.trim();
      if (!key || q.length < 2) {
        setPreds([]);
        return;
      }
      setLoadingPreds(true);
      setError(null);
      try {
        const merged: Prediction[] = [];
        const near = userLocation ?? undefined;

        if (looksLikeNumericPostcodeQuery(q)) {
          const places = await geocodeQueryToPlaces(q, { near });
          places.slice(0, 8).forEach((p, i) => {
            merged.push({
              id: `geo:post:${i}:${p.lat}:${p.lng}`,
              description: p.description,
              main: q.trim(),
              secondary: p.description,
              resolved: p,
            });
          });
          setPreds(merged);
          return;
        }

        let acUrl =
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}` +
          `&key=${key}&types=geocode`;
        if (near) {
          acUrl += `&location=${near.lat},${near.lng}&radius=50000`;
        }

        const res = await fetch(acUrl);
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
    },
    [key, userLocation]
  );

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
    if (pred.resolved) {
      if (focus === "pickup") {
        setPickupPlace(pred.resolved);
        setPickupQ(pred.resolved.description);
      } else {
        setDropPlace(pred.resolved);
        setDropQ(pred.resolved.description);
      }
      setPreds([]);
      return;
    }
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

  async function applyUserLocation(field: "pickup" | "dropoff") {
    if (!userLocation) return;
    setResolving(true);
    setError(null);
    try {
      const label =
        (await reverseGeocodeLabel(userLocation.lat, userLocation.lng)) ?? "Current location";
      const p: ResolvedPlace = {
        description: label,
        lat: userLocation.lat,
        lng: userLocation.lng,
      };
      if (field === "pickup") {
        setPickupPlace(p);
        setPickupQ(label);
      } else {
        setDropPlace(p);
        setDropQ(label);
      }
      setPreds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use current location.");
    } finally {
      setResolving(false);
    }
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
                  placeholder="Street, city, region, or postcode"
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
                  placeholder="Anywhere worldwide — city, country, address…"
                  placeholderTextColor="#5C6678"
                  className={`font-inter h-12 rounded-xl border px-4 text-sm text-text ${
                    focus === "dropoff" ? "border-primary" : "border-border"
                  } bg-surface2`}
                />
              </Pressable>

              {userLocation ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => void applyUserLocation("pickup")}
                    disabled={resolving}
                    className="flex-row items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-2 active:opacity-80"
                  >
                    <Ionicons name="navigate" size={16} color="#00D4AA" />
                    <Text className="font-inter ml-1.5 text-xs font-medium text-primary">
                      Pickup: my location
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void applyUserLocation("dropoff")}
                    disabled={resolving}
                    className="flex-row items-center rounded-full border border-border px-3 py-2 active:opacity-80"
                  >
                    <Ionicons name="flag" size={16} color="#8A94A6" />
                    <Text className="font-inter ml-1.5 text-xs text-textSecondary">
                      Drop-off: my location
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Text className="font-inter mt-3 text-xs leading-5 text-textSecondary">
                Search is worldwide. Suggestions are biased around your current location when available
                (cities, countries, addresses). Numeric postcodes use geocoding near your area.
              </Text>
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
                ListEmptyComponent={
                  !loadingPreds &&
                  (focus === "pickup" ? pickupQ.trim().length >= 2 : dropQ.trim().length >= 2) ? (
                    <Text className="font-inter py-4 text-center text-sm text-textSecondary">
                      No matches. Try a city, country, street, or postcode.
                    </Text>
                  ) : null
                }
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
