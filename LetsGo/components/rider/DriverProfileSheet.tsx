import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";

type Props = {
  visible: boolean;
  onClose: () => void;
  driverId: string | null;
};

type ReviewRow = { rating: number; comment: string | null; tags: string[] | null };

export function DriverProfileSheet({ visible, onClose, driverId }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [trips, setTrips] = useState(0);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, created_at")
        .eq("id", driverId)
        .maybeSingle();
      setName(prof?.full_name ?? "Driver");
      setAvatar((prof?.avatar_url as string | null) ?? null);
      setSince(prof?.created_at ? String(prof.created_at).slice(0, 10) : null);

      const { data: d } = await supabase
        .from("drivers")
        .select("rating, total_trips")
        .eq("id", driverId)
        .maybeSingle();
      if (d) {
        setRating(d.rating != null ? Number(d.rating) : 5);
        setTrips(Number(d.total_trips ?? 0));
      }

      const { data: v } = await supabase
        .from("vehicles")
        .select("make, model, color, plate_number")
        .eq("driver_id", driverId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (v) {
        setVehicle(`${v.color} ${v.make} ${v.model} · ${v.plate_number}`);
      } else {
        setVehicle(null);
      }

      const { data: rev } = await supabase
        .from("ratings")
        .select("rating, comment, tags")
        .eq("to_user_id", driverId)
        .order("created_at", { ascending: false })
        .limit(5);
      setReviews((rev ?? []) as ReviewRow[]);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (visible && driverId) void load();
  }, [visible, driverId, load]);

  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews) {
      for (const t of r.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [reviews]);

  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} sheetStyle={{ maxHeight: "90%" }}>
      <View className="px-5 pb-8">
        <View className="flex-row items-center justify-between">
          <Text className="font-sora text-lg font-bold text-text">Driver profile</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </Pressable>
        </View>

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
            <View className="flex-row items-center gap-4">
              <Avatar uri={avatar} name={name} size={64} />
              <View className="flex-1">
                <Text className="font-sora text-xl font-semibold text-text">{name}</Text>
                <Text className="font-inter mt-1 text-sm text-textSecondary">
                  {rating.toFixed(1)} ★ · {trips} trips
                  {since ? ` · Member since ${since}` : ""}
                </Text>
              </View>
            </View>

            {vehicle ? (
              <View className="mt-5 rounded-2xl border border-border bg-surface2 p-4">
                <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Vehicle</Text>
                <Text className="font-inter mt-1 text-sm text-text">{vehicle}</Text>
              </View>
            ) : null}

            <Text className="font-inter mb-2 mt-6 text-xs font-bold uppercase text-textSecondary">
              Recent feedback
            </Text>
            {reviews.length === 0 ? (
              <Text className="font-inter text-sm text-textSecondary">No public reviews yet.</Text>
            ) : (
              reviews.map((r, i) => (
                <View key={i} className="mb-3 rounded-xl border border-border bg-surface2 px-3 py-2">
                  <Text className="font-inter text-sm text-text">{r.rating.toFixed(1)} ★</Text>
                  {r.comment ? (
                    <Text className="font-inter mt-1 text-xs text-textSecondary">{r.comment}</Text>
                  ) : null}
                </View>
              ))
            )}

            {tagCloud.length ? (
              <View className="mt-4">
                <Text className="font-inter mb-2 text-xs font-bold uppercase text-textSecondary">Common tags</Text>
                <View className="flex-row flex-wrap gap-2">
                  {tagCloud.map(([label, n]) => (
                    <View
                      key={label}
                      className="rounded-full border border-border bg-surface2 px-3 py-1.5"
                    >
                      <Text className="font-inter text-xs text-text">
                        {label} · {n}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Text className="font-inter mt-6 text-center text-[11px] text-textSecondary">
              Reviews are from riders on past trips. Names are not shown.
            </Text>
          </ScrollView>
        )}
      </View>
    </AppBottomSheetModal>
  );
}
