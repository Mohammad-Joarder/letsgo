import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  "Payment issue",
  "Trip issue",
  "Account",
  "Safety",
  "Other",
] as const;

type TicketRow = {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
};

type TripPick = { id: string; pickup_address: string; dropoff_address: string; trip_completed_at: string | null };

type Props = {
  role: "rider" | "driver";
};

export function HelpSupportScreen({ role }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [recentTrips, setRecentTrips] = useState<TripPick[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"new" | "list">("new");

  const loadTickets = useCallback(async () => {
    if (!user?.id) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("id, category, subject, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    setTickets((data ?? []) as TicketRow[]);
    setLoadingList(false);
  }, [user?.id]);

  const loadTrips = useCallback(async () => {
    if (!user?.id) return;
    if (role === "rider") {
      const { data } = await supabase
        .from("trips")
        .select("id, pickup_address, dropoff_address, trip_completed_at")
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);
      setRecentTrips((data ?? []) as TripPick[]);
    } else {
      const { data } = await supabase
        .from("trips")
        .select("id, pickup_address, dropoff_address, trip_completed_at")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);
      setRecentTrips((data ?? []) as TripPick[]);
    }
  }, [user?.id, role]);

  useEffect(() => {
    void loadTickets();
    void loadTrips();
  }, [loadTickets, loadTrips]);

  async function submit() {
    if (!user?.id) return;
    const sub = subject.trim();
    const desc = description.trim();
    if (!sub || !desc) {
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        trip_id: tripId,
        category,
        subject: sub,
        description: desc,
        status: "open",
      });
      if (error) throw error;
      setSubject("");
      setDescription("");
      setTripId(null);
      await loadTickets();
      setTab("list");
      Alert.alert("Ticket submitted", "Our team will review your request.");
    } catch (e) {
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function statusTone(s: string): "success" | "warning" | "muted" {
    if (s === "resolved" || s === "closed") return "success";
    if (s === "in_progress") return "warning";
    return "muted";
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-row items-center border-b border-border bg-background px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-2 p-1">
          <Ionicons name="chevron-back" size={24} color="#E8ECF2" />
        </Pressable>
        <Text className="font-sora text-lg font-semibold text-text">Help & support</Text>
      </View>

      <View className="flex-row border-b border-border px-4">
        {(
          [
            ["new", "New ticket"],
            ["list", "My tickets"],
          ] as const
        ).map(([k, label]) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              className={`mr-4 border-b-2 py-3 ${on ? "border-primary" : "border-transparent"}`}
            >
              <Text className={`font-inter text-sm ${on ? "text-text" : "text-textSecondary"}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "list" ? (
        <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          {loadingList ? (
            <ActivityIndicator color="#00D4AA" className="mt-8" />
          ) : tickets.length === 0 ? (
            <Text className="font-inter mt-8 text-center text-textSecondary">No tickets yet.</Text>
          ) : (
            tickets.map((t) => (
              <Card key={t.id} className="mb-3">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="font-sora flex-1 text-sm font-semibold text-text" numberOfLines={2}>
                    {t.subject}
                  </Text>
                  <Badge label={t.status.replace(/_/g, " ")} tone={statusTone(t.status)} />
                </View>
                <Text className="font-inter mt-1 text-xs text-textSecondary">{t.category}</Text>
                <Text className="font-inter mt-2 text-[11px] text-textSecondary">
                  {new Date(t.created_at).toLocaleString()}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Category</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 ${on ? "border-primary bg-primary/15" : "border-border"}`}
                >
                  <Text className="font-inter text-xs text-text">{c}</Text>
                </Pressable>
              );
            })}
          </View>

          {(category === "Trip issue" || category === "Safety" || category === "Payment issue") && (
            <>
              <Text className="font-inter mb-2 mt-6 text-xs font-semibold uppercase text-textSecondary">
                Related trip (optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                <Pressable
                  onPress={() => setTripId(null)}
                  className={`mx-1 rounded-xl border px-3 py-2 ${tripId == null ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <Text className="font-inter text-xs text-text">None</Text>
                </Pressable>
                {recentTrips.map((tr) => {
                  const on = tripId === tr.id;
                  return (
                    <Pressable
                      key={tr.id}
                      onPress={() => setTripId(tr.id)}
                      className={`mx-1 max-w-[220px] rounded-xl border px-3 py-2 ${on ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <Text className="font-inter text-[11px] text-textSecondary" numberOfLines={2}>
                        {tr.pickup_address} → {tr.dropoff_address}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text className="font-inter mb-2 mt-6 text-xs font-semibold uppercase text-textSecondary">Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Short summary"
            placeholderTextColor="#5C6678"
            className="font-inter rounded-xl border border-border bg-surface2 px-3 py-3 text-sm text-text"
          />

          <Text className="font-inter mb-2 mt-4 text-xs font-semibold uppercase text-textSecondary">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened?"
            placeholderTextColor="#5C6678"
            multiline
            className="font-inter min-h-[120px] rounded-xl border border-border bg-surface2 p-3 text-sm text-text"
          />

          <View className="mt-8">
            <Button title="Submit ticket" loading={submitting} onPress={() => void submit()} />
          </View>
        </ScrollView>
      )}
    </SafeAreaWrapper>
  );
}
