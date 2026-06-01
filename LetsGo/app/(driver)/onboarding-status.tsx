import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { OnboardingStepsChecklist } from "@/components/driver/onboarding/OnboardingStepsChecklist";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { buildDeviceFingerprintPayload } from "@/lib/buildDeviceFingerprint";
import { edgeRegisterDevice } from "@/lib/complianceEdgeCalls";
import { signOut } from "@/lib/auth";
import type { DriverApprovalStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type DocRow = {
  document_type: string;
  is_verified: boolean;
  rejection_reason: string | null;
};

function toneForDoc(d: DocRow): "success" | "warning" | "muted" {
  if (d.rejection_reason && !d.is_verified) return "warning";
  if (d.is_verified) return "success";
  return "muted";
}

export default function DriverOnboardingStatusScreen() {
  const router = useRouter();
  const { user, refreshProfile, driverApproval, session } = useAuth();
  const { flags: driverFf } = useDriverRegistrationFeatureFlags();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [vehicleLabel, setVehicleLabel] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const deviceFpSent = useRef(false);

  const ap = driverApproval ?? ("pending" as DriverApprovalStatus);

  const showVerificationCard = driverFf.driver_email_verification_gate;
  const emailOk = Boolean(user?.email_confirmed_at);
  const verificationAttention = showVerificationCard && !emailOk;

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data: docRows } = await supabase
      .from("driver_documents")
      .select("document_type, is_verified, rejection_reason")
      .eq("driver_id", user.id);
    setDocs((docRows ?? []) as DocRow[]);
    const { data: v } = await supabase
      .from("vehicles")
      .select("make, model, plate_number")
      .eq("driver_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (v) setVehicleLabel(`${v.make} ${v.model} · ${v.plate_number}`);
    else setVehicleLabel(null);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || !session?.access_token || !driverFf.driver_device_fingerprinting || deviceFpSent.current) {
      return;
    }
    deviceFpSent.current = true;
    void (async () => {
      try {
        const payload = buildDeviceFingerprintPayload();
        await edgeRegisterDevice(session.access_token, payload);
      } catch {
        /* non-blocking */
      }
    })();
  }, [user?.id, session?.access_token, driverFf.driver_device_fingerprinting]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshProfile();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function onSignOut() {
    Alert.alert("Sign out?", "You can sign back in with the same account to continue your application.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch (e) {
              Alert.alert("Could not sign out", e instanceof Error ? e.message : "Try again");
            } finally {
              setSigningOut(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-6" contentContainerStyle={{ paddingBottom: 48 }}>
        <Text className="font-sora-display text-2xl font-bold text-text">Driver application</Text>
        <Text className="font-inter mt-2 text-sm text-textSecondary">
          Complete onboarding, then submit for review. You can resume any time — progress is saved on your device.
        </Text>

        <View className="mt-6 flex-row flex-wrap items-center gap-3">
          <Badge
            label={ap.replace(/_/g, " ")}
            tone={ap === "approved" ? "success" : ap === "under_review" ? "warning" : "muted"}
          />
          {vehicleLabel ? (
            <Text className="font-inter flex-1 text-xs text-textSecondary" numberOfLines={2}>
              {vehicleLabel}
            </Text>
          ) : null}
        </View>

        <Button
          title={refreshing ? "Refreshing…" : "Refresh status"}
          variant="secondary"
          className="mt-6"
          loading={refreshing}
          onPress={() => void onRefresh()}
        />

        {showVerificationCard ? (
          <Pressable
            onPress={() => router.push("/(driver)/onboarding/verification-hub" as Href)}
            className="mt-4"
          >
            <Card className={verificationAttention ? "border border-primary/50 bg-primary/5" : ""}>
              <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Account verification</Text>
              <Text className="font-inter mt-2 text-sm text-text">
                Email:{" "}
                {driverFf.driver_email_verification_gate ? (
                  <Text className={emailOk ? "text-primary" : "text-error"}>{emailOk ? "Verified" : "Required"}</Text>
                ) : (
                  <Text className="text-textSecondary">Not required</Text>
                )}
              </Text>
              <Text className="font-inter mt-2 text-xs text-primary">Open verification hub →</Text>
            </Card>
          </Pressable>
        ) : null}

        {(ap === "pending" || ap === "under_review") && (
          <View className="mt-6 gap-3">
            <Button
              title={ap === "under_review" ? "View onboarding steps" : "Continue onboarding"}
              onPress={() => router.push("/(driver)/onboarding" as Href)}
            />
            {ap === "pending" ? (
              <Button
                title="Submit for review (final step)"
                variant="secondary"
                onPress={() => router.push("/(driver)/onboarding/step8-review" as Href)}
              />
            ) : null}
          </View>
        )}

        {(ap === "pending" || ap === "under_review") && (
          <>
            <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase text-textSecondary">
              Onboarding steps
            </Text>
            <Text className="font-inter mb-3 text-xs leading-5 text-textSecondary">
              Tap any step to review or update it. Use Back on each screen to move to the previous step, or return here
              via Application overview.
            </Text>
            <OnboardingStepsChecklist includeSubmitStep={ap === "pending"} />
          </>
        )}

        <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase text-textSecondary">Documents</Text>
        <Card className="p-0">
          {docs.length === 0 ? (
            <Text className="font-inter p-4 text-sm text-textSecondary">No uploads yet — start onboarding.</Text>
          ) : (
            docs.map((d) => (
              <View key={d.document_type} className="border-b border-border/60 px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-inter text-sm capitalize text-text">{d.document_type.replace(/_/g, " ")}</Text>
                  <Badge
                    label={
                      d.rejection_reason && !d.is_verified
                        ? "Rejected"
                        : d.is_verified
                          ? "Approved"
                          : "Pending"
                    }
                    tone={toneForDoc(d)}
                  />
                </View>
                {d.rejection_reason ? (
                  <Text className="font-inter mt-2 text-xs text-error">{d.rejection_reason}</Text>
                ) : null}
                {d.rejection_reason && !d.is_verified ? (
                  <Pressable
                    onPress={() => {
                      const t = d.document_type;
                      const map: Record<string, Href> = {
                        license_front: "/(driver)/onboarding/step2-license" as Href,
                        license_back: "/(driver)/onboarding/step2-license" as Href,
                        vehicle_registration: "/(driver)/onboarding/step4-vehicle-docs" as Href,
                        insurance: "/(driver)/onboarding/step4-vehicle-docs" as Href,
                        vehicle_photo: "/(driver)/onboarding/step5-vehicle-photo" as Href,
                        profile_photo: "/(driver)/onboarding/step6-profile-photo" as Href,
                      };
                      const href = map[t] ?? ("/(driver)/onboarding" as Href);
                      router.push(href);
                    }}
                    className="mt-2"
                  >
                    <Text className="font-inter text-xs text-primary">Re-upload</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </Card>

        <Text className="font-inter mt-4 text-xs leading-5 text-textSecondary">
          Estimated review time: within 24 hours on business days. You will be notified when your application is
          approved.
        </Text>

        <Pressable onPress={() => void onSignOut()} disabled={signingOut} className="mt-8 items-center py-3">
          <Text className="font-inter text-sm text-error">{signingOut ? "Signing out…" : "Sign out"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
