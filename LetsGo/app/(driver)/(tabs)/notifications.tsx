import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data: Record<string, unknown> | null;
};

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at, data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    void load();
  }

  async function markAllRead() {
    if (!user?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    void load();
  }

  function onOpen(row: Row) {
    void markRead(row.id);
    const tripId = row.data && typeof row.data === "object" && "trip_id" in row.data ? String(row.data.trip_id) : "";
    if (tripId) {
      router.push(`/(driver)/trip-active?tripId=${encodeURIComponent(tripId)}`);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <View className="flex-1 bg-background px-5 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-sora text-2xl font-bold text-text">Notifications</Text>
          <Pressable onPress={() => void markAllRead()} className="py-2">
            <Text className="font-inter text-sm font-semibold text-primary">Mark all read</Text>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color="#00D4AA" className="mt-10" />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={
              <Text className="font-inter mt-10 text-center text-textSecondary">No notifications yet.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onOpen(item)}
                className={`mb-3 rounded-2xl border px-4 py-3 ${
                  item.is_read ? "border-border bg-surface2/40" : "border-primary/40 bg-primary/10"
                }`}
              >
                <Text className="font-sora text-base font-semibold text-text">{item.title}</Text>
                <Text className="font-inter mt-1 text-sm text-textSecondary">{item.body}</Text>
                <Text className="font-inter mt-2 text-xs text-textSecondary">
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaWrapper>
  );
}
