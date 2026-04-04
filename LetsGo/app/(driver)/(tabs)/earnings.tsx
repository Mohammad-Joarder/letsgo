import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { createPayout } from "@/lib/driverEdge";
import { supabase } from "@/lib/supabase";

type WeekRow = { week_start: string; net_earnings: number; payout_status: string };
type TripRow = { id: string; trip_completed_at: string | null; final_fare: number | null; pickup_address: string };

export default function DriverEarningsScreen() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<WeekRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data: s } = await supabase
      .from("driver_earnings_summary")
      .select("week_start, net_earnings, payout_status")
      .eq("driver_id", user.id)
      .order("week_start", { ascending: false })
      .limit(12);
    setSummaries((s ?? []) as WeekRow[]);

    const { data: t } = await supabase
      .from("trips")
      .select("id, trip_completed_at, final_fare, pickup_address")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .order("trip_completed_at", { ascending: false })
      .limit(30);
    setTrips((t ?? []) as TripRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const thisWeekNet = summaries[0]?.net_earnings != null ? Number(summaries[0].net_earnings) : 0;
  const totalNet = useMemo(
    () => summaries.reduce((s, r) => s + Number(r.net_earnings), 0),
    [summaries]
  );
  const pendingPayout = useMemo(
    () =>
      summaries
        .filter((r) => r.payout_status === "pending")
        .reduce((s, r) => s + Number(r.net_earnings), 0),
    [summaries]
  );

  const chartData = useMemo(() => {
    const asc = [...summaries].reverse();
    return asc.slice(-8).map((r) => ({
      value: Number(r.net_earnings),
      label: r.week_start.slice(5),
    }));
  }, [summaries]);

  async function onPayout() {
    setPayoutLoading(true);
    try {
      const res = await createPayout();
      if (!res.ok) throw new Error(res.error ?? "Failed");
      Alert.alert("Payout queued", res.message ?? "OK");
      void load();
    } catch (e) {
      Alert.alert("Payout", e instanceof Error ? e.message : "Try again.");
    } finally {
      setPayoutLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right"]}>
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator color="#00D4AA" />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-sora-display text-2xl font-bold text-text">Earnings</Text>

        <View className="mt-6 flex-row flex-wrap gap-3">
          <MiniCard title="Latest week" value={`$${thisWeekNet.toFixed(2)}`} />
          <MiniCard title="Total (shown)" value={`$${totalNet.toFixed(2)}`} />
          <MiniCard title="Pending payout" value={`$${pendingPayout.toFixed(2)}`} />
        </View>

        {chartData.length > 0 ? (
          <Card className="mt-6 overflow-hidden">
            <Text className="font-inter mb-4 text-xs font-semibold uppercase text-textSecondary">
              Weekly net (recent)
            </Text>
            <LineChart
              data={chartData}
              height={180}
              spacing={44}
              initialSpacing={8}
              color="#00D4AA"
              thickness={2}
              hideRules={false}
              xAxisColor="#1E2D45"
              yAxisColor="#1E2D45"
              yAxisTextStyle={{ color: "#8A94A6", fontSize: 10 }}
              xAxisLabelTextStyle={{ color: "#8A94A6", fontSize: 9 }}
              curved
              areaChart
              startFillColor="rgba(0,212,170,0.35)"
              endFillColor="rgba(0,212,170,0.02)"
              dataPointsColor="#00D4AA"
            />
          </Card>
        ) : (
          <Card className="mt-6">
            <Text className="font-inter text-sm text-textSecondary">
              Complete trips to see your weekly earnings chart.
            </Text>
          </Card>
        )}

        <View className="mt-6">
          <Button title="Request payout" loading={payoutLoading} onPress={() => void onPayout()} />
        </View>

        <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Recent trips
        </Text>
        {trips.length === 0 ? (
          <Card>
            <Text className="font-inter text-sm text-textSecondary">No completed trips yet.</Text>
          </Card>
        ) : (
          trips.map((t) => (
            <Card key={t.id} className="mb-3">
              <Text className="font-inter text-xs text-textSecondary">
                {t.trip_completed_at
                  ? new Date(t.trip_completed_at).toLocaleString()
                  : "—"}
              </Text>
              <Text className="font-inter mt-1 text-sm text-text" numberOfLines={1}>
                {t.pickup_address}
              </Text>
              <Text className="font-sora mt-2 text-base font-bold text-primary">
                ${Number(t.final_fare ?? 0).toFixed(2)}
              </Text>
            </Card>
          ))
        )}

        <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Payout history
        </Text>
        {summaries.filter((s) => s.payout_status !== "pending").length === 0 ? (
          <Text className="font-inter text-sm text-textSecondary">No processed payouts yet.</Text>
        ) : (
          summaries
            .filter((s) => s.payout_status !== "pending")
            .map((s) => (
              <Pressable key={s.week_start} className="border-b border-border py-3">
                <Text className="font-inter text-sm text-text">
                  Week of {s.week_start} · ${Number(s.net_earnings).toFixed(2)}
                </Text>
                <Text className="font-inter text-xs text-textSecondary">{s.payout_status}</Text>
              </Pressable>
            ))
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <View className="min-w-[30%] flex-1 rounded-2xl border border-border bg-surface2 px-3 py-3">
      <Text className="font-inter text-xs text-textSecondary">{title}</Text>
      <Text className="font-sora mt-1 text-lg font-bold text-text">{value}</Text>
    </View>
  );
}
