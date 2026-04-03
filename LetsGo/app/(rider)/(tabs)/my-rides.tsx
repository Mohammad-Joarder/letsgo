import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type TripRow = {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  estimated_fare: number | null;
  final_fare: number | null;
  created_at: string;
  trip_completed_at: string | null;
  driver_rating: number | null;
  ride_type: string;
};

const UPCOMING = new Set([
  "searching",
  "driver_accepted",
  "driver_arrived",
  "in_progress",
]);

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "completed") return "text-primary";
  if (status === "cancelled" || status === "no_driver_found") return "text-error";
  return "text-orange-400";
}

export default function RiderMyRidesScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TripRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: qErr } = await supabase
      .from("trips")
      .select(
        "id, status, pickup_address, dropoff_address, estimated_fare, final_fare, created_at, trip_completed_at, driver_rating, ride_type"
      )
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as TripRow[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(
    () => rows.filter((r) => UPCOMING.has(r.status)),
    [rows]
  );
  const past = useMemo(
    () => rows.filter((r) => !UPCOMING.has(r.status)),
    [rows]
  );

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <View className="flex-1 bg-background px-6 pt-6">
        <Text className="font-sora-display text-2xl font-bold text-text">My rides</Text>

        <View className="mt-6 flex-row rounded-2xl bg-surface2 p-1">
          {(["upcoming", "past"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 rounded-xl py-2.5 ${tab === t ? "bg-primary/20" : ""}`}
            >
              <Text
                className={`font-inter text-center text-sm font-semibold capitalize ${
                  tab === t ? "text-primary" : "text-textSecondary"
                }`}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color="#00D4AA" />
          </View>
        ) : error ? (
          <Text className="font-inter mt-8 text-center text-sm text-error">{error}</Text>
        ) : list.length === 0 ? (
          <Card className="mt-10 items-center py-12">
            <Ionicons name="car-outline" size={40} color="#5C6678" />
            <Text className="font-inter mt-4 text-center text-textSecondary">
              {tab === "upcoming" ? "No upcoming trips." : "No past trips yet."}
            </Text>
          </Card>
        ) : (
          <ScrollView className="mt-6 flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
            {list.map((trip) => (
              <Pressable key={trip.id} onPress={() => setSelected(trip)} className="mb-4">
                <Card className="border border-border/80">
                  <Text className="font-inter text-xs text-textSecondary">
                    {new Date(trip.created_at).toLocaleString()}
                  </Text>
                  <Text className="font-inter mt-2 text-sm text-text" numberOfLines={1}>
                    {trip.pickup_address}
                  </Text>
                  <View className="my-1 flex-row items-center gap-1">
                    <Ionicons name="arrow-down" size={14} color="#5C6678" />
                    <Text className="font-inter flex-1 text-sm text-textSecondary" numberOfLines={1}>
                      {trip.dropoff_address}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className={`font-inter text-xs font-semibold capitalize ${statusTone(trip.status)}`}>
                      {statusLabel(trip.status)}
                    </Text>
                    <Text className="font-sora text-base font-bold text-text">
                      $
                      {(trip.final_fare ?? trip.estimated_fare ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  {tab === "past" && trip.driver_rating != null ? (
                    <Text className="font-inter mt-2 text-xs text-textSecondary">
                      You rated driver: {trip.driver_rating.toFixed(1)} ★
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal visible={selected != null} animationType="slide" transparent>
        <Pressable className="flex-1 justify-end bg-black/55" onPress={() => setSelected(null)}>
          <Pressable
            className="max-h-[85%] rounded-t-3xl border border-border bg-surface px-6 pb-10 pt-6"
            onPress={(e) => e.stopPropagation()}
          >
            {selected ? (
              <>
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="font-sora text-lg font-semibold text-text">Trip details</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                    <Ionicons name="close" size={24} color="#8A94A6" />
                  </Pressable>
                </View>
                <ScrollView>
                  <DetailRow label="Status" value={statusLabel(selected.status)} />
                  <DetailRow label="Ride type" value={selected.ride_type} />
                  <DetailRow label="Pickup" value={selected.pickup_address} />
                  <DetailRow label="Drop-off" value={selected.dropoff_address} />
                  <DetailRow
                    label="Fare"
                    value={`$${(selected.final_fare ?? selected.estimated_fare ?? 0).toFixed(2)}`}
                  />
                  <DetailRow
                    label="Booked"
                    value={new Date(selected.created_at).toLocaleString()}
                  />
                  {selected.trip_completed_at ? (
                    <DetailRow
                      label="Completed"
                      value={new Date(selected.trip_completed_at).toLocaleString()}
                    />
                  ) : null}
                  {selected.driver_rating != null ? (
                    <DetailRow
                      label="Your rating (driver)"
                      value={`${selected.driver_rating.toFixed(1)} / 5`}
                    />
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaWrapper>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-4">
      <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">{label}</Text>
      <Text className="font-inter mt-1 text-sm leading-5 text-text">{value}</Text>
    </View>
  );
}
