import type { Href } from "expo-router";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { postEdgeFunctionWithUserJwt } from "@/lib/edgeFunctionFetch";

type DriverRow = {
  id: string;
  approval_status: string;
  fraud_risk_level: string | null;
  license_number: string | null;
  abn: string | null;
  abn_entity_name: string | null;
};

export default function AdminComplianceQueueScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; phone: string | null }>>({});
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = (await postEdgeFunctionWithUserJwt("admin-compliance-drivers", {}, session.access_token, 30_000)) as {
        ok?: boolean;
        drivers?: DriverRow[];
        profiles?: Record<string, { full_name: string | null; phone: string | null }>;
        document_counts?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) throw new Error(res.error ?? "Failed to load");
      setDrivers(res.drivers ?? []);
      setProfiles(res.profiles ?? {});
      setDocCounts(res.document_counts ?? {});
    } catch (e) {
      Alert.alert("Compliance", e instanceof Error ? e.message : "Could not load queue");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <ScrollView className="flex-1 bg-background px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} className="mb-3 py-2">
          <Text className="font-inter text-sm text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sora-display text-2xl font-bold text-text">Driver compliance queue</Text>
        <Text className="font-inter mt-2 text-sm text-textSecondary">
          Open the full application review for a driver. Every uploaded file is shown there with a checklist —{" "}
          <Text className="font-inter font-semibold text-text">Confirm approve</Text> is only available on that page
          after you tick each document you have checked.
        </Text>
        <Button title={loading ? "Loading…" : "Refresh"} className="mt-4" variant="secondary" onPress={() => void load()} />

        {drivers.map((d) => {
          const p = profiles[d.id];
          const n = docCounts[d.id] ?? 0;
          const href = `/(auth)/admin-compliance/review/${d.id}` as Href;
          return (
            <Link key={d.id} href={href} asChild>
              <Pressable className="active:opacity-90">
                <Card className="mt-4 p-4">
                  <View className="flex-row items-center">
                    <View className="flex-1 pr-2">
                      <Text className="font-inter text-base font-semibold text-text">{p?.full_name ?? "Driver"}</Text>
                      <Text className="font-inter mt-1 text-xs text-textSecondary">{p?.phone ?? ""}</Text>
                      <Text className="font-inter mt-2 text-xs text-textSecondary">
                        {d.approval_status} · Fraud: {d.fraud_risk_level ?? "—"} · {n} document{n === 1 ? "" : "s"}
                      </Text>
                      <Text className="font-inter mt-1 text-xs text-textSecondary">
                        Licence {d.license_number ?? "—"} · ABN {d.abn ?? "—"}
                        {d.abn_entity_name ? ` (${d.abn_entity_name})` : ""}
                      </Text>
                      <Text className="font-inter mt-3 text-sm font-semibold text-primary">Open full review →</Text>
                    </View>
                    <View className="items-center justify-center rounded-full bg-primary/15 px-3 py-2">
                      <MaterialCommunityIcons name="file-document-outline" size={24} color="#00D4AA" />
                      <MaterialCommunityIcons name="chevron-right" size={22} color="#00D4AA" />
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Link>
          );
        })}

        <Button
          title="Open audit log (Supabase)"
          variant="secondary"
          className="mt-8"
          onPress={() => {
            Alert.alert(
              "Audit",
              "Query public.compliance_audit_log in the Supabase SQL editor (admin read policy applies)."
            );
          }}
        />
      </ScrollView>
    </SafeAreaWrapper>
  );
}
