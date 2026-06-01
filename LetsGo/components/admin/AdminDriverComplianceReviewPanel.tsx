import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { postEdgeFunctionWithUserJwt } from "@/lib/edgeFunctionFetch";

type DocSlot = { key: string; label: string; signed_url: string | null };

export type DetailPayload = {
  ok?: boolean;
  error?: string;
  profile?: { full_name: string | null; phone: string | null; email: string | null };
  driver?: {
    id: string;
    approval_status: string;
    fraud_risk_level: string | null;
    license_number: string | null;
    license_expiry: string | null;
    license_first_issued: string | null;
    insurance_expiry: string | null;
    vehicle_inspection_expiry: string | null;
    abn: string | null;
    abn_entity_name: string | null;
    abn_verified_at: string | null;
    bank_bsb_masked: string | null;
    bank_account_masked: string | null;
  };
  vehicle?: {
    make: string | null;
    model: string | null;
    plate_number: string | null;
    year: number | null;
    color: string | null;
  } | null;
  documents?: DocSlot[];
};

export type AdminDriverComplianceReviewPanelProps = {
  driverId: string;
  accessToken: string | null | undefined;
  onBack: () => void;
  /** Called after a successful approve / reject / suspend / request_resubmit. */
  onCompleted: () => void;
};

export function AdminDriverComplianceReviewPanel({
  driverId,
  accessToken,
  onBack,
  onCompleted,
}: AdminDriverComplianceReviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("See compliance review — please re-upload clearer documents.");

  const load = useCallback(async () => {
    if (!accessToken || !driverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await postEdgeFunctionWithUserJwt(
        "admin-compliance-driver-detail",
        { driver_id: driverId },
        accessToken,
        60_000
      )) as DetailPayload;
      if (!res.ok) throw new Error(res.error ?? "Failed to load driver");
      setDetail(res);
      setAck({});
    } catch (e) {
      Alert.alert("Review", e instanceof Error ? e.message : "Could not load");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const documents = detail?.documents ?? [];
  const presentDocs = useMemo(() => documents.filter((d) => d.signed_url), [documents]);
  const reviewedCount = presentDocs.filter((d) => ack[d.key]).length;
  const allPresentReviewed = presentDocs.length > 0 && presentDocs.every((d) => ack[d.key]);

  function toggleAck(key: string) {
    setAck((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function runAction(action: "approve" | "reject" | "suspend" | "request_resubmit") {
    if (!accessToken || !driverId) return;
    if (action === "approve" && !allPresentReviewed) {
      Alert.alert(
        "Review each document",
        "Tick every uploaded document after you have visually checked it. Approve is only available from this review page."
      );
      return;
    }
    if (action === "reject" && !rejectReason.trim()) {
      Alert.alert("Reason", "Enter a short reason for the driver.");
      return;
    }
    if (action === "request_resubmit" && !rejectReason.trim()) {
      Alert.alert("Reason", "Enter a short note for the driver.");
      return;
    }
    setBusy(true);
    try {
      const res = (await postEdgeFunctionWithUserJwt(
        "admin-compliance-action",
        {
          driver_id: driverId,
          action,
          reason: action === "reject" || action === "request_resubmit" ? rejectReason.trim() : null,
        },
        accessToken,
        30_000
      )) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Action failed");
      onCompleted();
    } catch (e) {
      Alert.alert("Action", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const p = detail?.profile;
  const d = detail?.driver;
  const v = detail?.vehicle;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1 pr-2">
            <Text className="font-sora-display text-lg font-bold text-text">Application review</Text>
            <Text className="font-inter mt-0.5 text-xs text-textSecondary">Approve only after all uploads are checked</Text>
          </View>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to queue"
            className="rounded-full bg-surface2 px-4 py-2 active:opacity-80"
          >
            <Text className="font-inter text-sm font-semibold text-primary">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-3" contentContainerStyle={{ paddingBottom: 48 }}>
          <Text className="font-inter text-sm text-textSecondary">
            Scroll through every document below. Tick each file after you have visually verified it.{" "}
            <Text className="font-inter font-semibold text-text">Confirm approve</Text> stays disabled until every
            uploaded file is ticked — there is no approve shortcut from the queue list.
          </Text>

          {loading ? (
            <Card className="mt-6 items-center py-10">
              <ActivityIndicator color="#00D4AA" />
              <Text className="font-inter mt-3 text-xs text-textSecondary">Loading documents…</Text>
            </Card>
          ) : !detail || !d ? (
            <Button title="Retry" className="mt-6" variant="secondary" onPress={() => void load()} />
          ) : (
            <>
              <Card className="mt-4 p-4">
                <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Driver</Text>
                <Text className="font-inter mt-2 text-lg font-semibold text-text">{p?.full_name ?? "—"}</Text>
                <Text className="font-inter mt-1 text-sm text-textSecondary">{p?.email ?? ""}</Text>
                <Text className="font-inter mt-1 text-sm text-textSecondary">{p?.phone ?? ""}</Text>
                <Text className="font-inter mt-3 text-xs text-textSecondary">
                  Status: {d.approval_status} · Fraud: {d.fraud_risk_level ?? "—"}
                </Text>
              </Card>

              <Card className="mt-3 p-4">
                <Text className="font-inter text-xs font-bold uppercase text-textSecondary">On file</Text>
                <Text className="font-inter mt-2 text-sm text-text">Licence: {d.license_number ?? "—"}</Text>
                <Text className="font-inter mt-1 text-xs text-textSecondary">Expires: {d.license_expiry ?? "—"}</Text>
                <Text className="font-inter mt-1 text-xs text-textSecondary">
                  First issued (4a): {d.license_first_issued ?? "—"}
                </Text>
                <Text className="font-inter mt-2 text-sm text-text">
                  ABN: {d.abn ?? "—"} {d.abn_entity_name ? `· ${d.abn_entity_name}` : ""}
                </Text>
                {d.abn_verified_at ? (
                  <Text className="font-inter mt-1 text-xs text-primary">ABN verified at {d.abn_verified_at}</Text>
                ) : null}
                <Text className="font-inter mt-2 text-xs text-textSecondary">
                  Insurance expiry: {d.insurance_expiry ?? "—"}
                </Text>
                <Text className="font-inter mt-1 text-xs text-textSecondary">
                  Inspection expiry: {d.vehicle_inspection_expiry ?? "—"}
                </Text>
                <Text className="font-inter mt-2 text-xs text-textSecondary">
                  Bank BSB: {d.bank_bsb_masked ?? "—"} · Account: {d.bank_account_masked ?? "—"}
                </Text>
              </Card>

              {v ? (
                <Card className="mt-3 p-4">
                  <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Vehicle</Text>
                  <Text className="font-inter mt-2 text-sm text-text">
                    {v.make ?? ""} {v.model ?? ""}
                    {v.year != null ? ` · ${v.year}` : ""}
                    {v.color ? ` · ${v.color}` : ""}
                  </Text>
                  <Text className="font-inter mt-1 text-xs text-textSecondary">Plate: {v.plate_number ?? "—"}</Text>
                </Card>
              ) : null}

              <View className="mt-4 flex-row items-center justify-between rounded-xl border border-border bg-surface2/50 px-3 py-2">
                <Text className="font-inter text-sm text-text">Document checklist</Text>
                <Text className="font-inter text-sm font-semibold text-primary">
                  {reviewedCount}/{presentDocs.length} reviewed
                </Text>
              </View>

              {documents.map((slot) => (
                <Card key={slot.key} className="mt-3 overflow-hidden p-0">
                  <View className="border-b border-border/60 px-4 py-3">
                    <Text className="font-inter text-sm font-semibold text-text">{slot.label}</Text>
                  </View>
                  {slot.signed_url ? (
                    <Image
                      source={{ uri: slot.signed_url }}
                      style={{ width: "100%", height: 280, backgroundColor: "#1a1f2e" }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="items-center justify-center bg-surface2 px-4 py-10">
                      <Text className="font-inter text-center text-sm text-textSecondary">Not uploaded</Text>
                    </View>
                  )}
                  {slot.signed_url ? (
                    <Pressable
                      onPress={() => toggleAck(slot.key)}
                      className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
                    >
                      <MaterialCommunityIcons
                        name={ack[slot.key] ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                        size={26}
                        color={ack[slot.key] ? "#00D4AA" : "#8A94A6"}
                      />
                      <Text className="font-inter flex-1 text-sm text-text">I have visually reviewed this document</Text>
                    </Pressable>
                  ) : null}
                </Card>
              ))}

              <Card className="mt-4 p-4">
                <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Reject / resubmit note</Text>
                <TextInput
                  className="font-inter mt-2 min-h-[88px] rounded-xl border border-border bg-background px-3 py-2 text-sm text-text"
                  multiline
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholderTextColor="#8A94A6"
                  placeholder="Shown to the driver when rejecting or requesting resubmit."
                />
              </Card>

              <View className="mt-6 gap-3">
                <Button
                  title="Confirm approve"
                  loading={busy}
                  disabled={busy || !allPresentReviewed}
                  onPress={() => void runAction("approve")}
                />
                {!allPresentReviewed && presentDocs.length > 0 ? (
                  <Text className="font-inter text-center text-xs text-textSecondary">
                    Confirm approve unlocks after all {presentDocs.length} uploaded document(s) are ticked as reviewed.
                  </Text>
                ) : null}
                {presentDocs.length === 0 ? (
                  <Text className="font-inter text-center text-xs text-error">
                    No documents on file — reject or request resubmit instead of approving.
                  </Text>
                ) : null}
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    title="Reject"
                    variant="secondary"
                    loading={busy}
                    className="min-w-[100px] flex-1"
                    onPress={() => void runAction("reject")}
                  />
                  <Button
                    title="Request resubmit"
                    variant="secondary"
                    loading={busy}
                    className="min-w-[120px] flex-1"
                    onPress={() => void runAction("request_resubmit")}
                  />
                  <Button
                    title="Suspend"
                    variant="secondary"
                    loading={busy}
                    className="min-w-[100px] flex-1"
                    onPress={() => void runAction("suspend")}
                  />
                </View>
                <Button title="Refresh images" variant="secondary" disabled={busy} onPress={() => void load()} />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaWrapper>
    </View>
  );
}
