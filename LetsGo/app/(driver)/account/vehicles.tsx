import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  color: string;
  plate_number: string;
  ride_type: string;
  is_active: boolean;
  is_approved: boolean;
};

export default function DriverVehiclesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("vehicles")
      .select("id, make, model, color, plate_number, ride_type, is_active, is_approved")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as VehicleRow[]);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setActive(id: string) {
    if (!user?.id) return;
    setBusyId(id);
    try {
      const { error: u1 } = await supabase.from("vehicles").update({ is_active: false }).eq("driver_id", user.id);
      if (u1) throw u1;
      const { error: u2 } = await supabase.from("vehicles").update({ is_active: true }).eq("id", id);
      if (u2) throw u2;
      await load();
    } catch (e) {
      Alert.alert("Could not update", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} className="mb-4 self-start py-2">
          <Text className="font-inter text-sm text-primary">Back</Text>
        </Pressable>
        <Text className="font-sora-display text-2xl font-bold text-text">Vehicles</Text>
        <Text className="font-inter mt-2 text-sm text-textSecondary">
          Active vehicle is offered to riders. Changes may require re-approval.
        </Text>

        <Button
          title="Add vehicle"
          className="mt-8"
          onPress={() => router.push("/(driver)/onboarding/step3-vehicle?mode=add" as Href)}
        />

        <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase text-textSecondary">Your vehicles</Text>
        {rows.length === 0 ? (
          <Card>
            <Text className="font-inter text-sm text-textSecondary">No vehicles yet — add one to continue.</Text>
          </Card>
        ) : (
          rows.map((v) => (
            <Card key={v.id} className="mb-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="font-sora text-lg font-semibold text-text">
                    {v.make} {v.model}
                  </Text>
                  <Text className="font-inter mt-1 text-sm text-textSecondary">
                    {v.color} · {v.plate_number} · {v.ride_type}
                  </Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {v.is_active ? <Badge label="Active" tone="success" /> : null}
                    <Badge label={v.is_approved ? "Approved" : "Pending review"} tone={v.is_approved ? "success" : "muted"} />
                  </View>
                </View>
              </View>
              {!v.is_active ? (
                <Button
                  title="Set as active"
                  variant="secondary"
                  className="mt-4"
                  loading={busyId === v.id}
                  onPress={() => void setActive(v.id)}
                />
              ) : null}
              <Pressable
                onPress={() => router.push("/(driver)/onboarding/step3-vehicle" as Href)}
                className="mt-3"
              >
                <Text className="font-inter text-xs text-primary">Edit in onboarding wizard</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}
