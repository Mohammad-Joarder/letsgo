import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ColorThemePicker } from "@/components/settings/ColorThemePicker";
import { signOut } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { requestRiderIdVerification } from "@/lib/riderEdge";
import { isStripeConfigured } from "@/lib/stripeConfig";
import { supabase } from "@/lib/supabase";

type RiderRow = {
  rating: number;
  wallet_balance: number;
  is_verified_id: boolean;
};

function Row({
  icon,
  title,
  subtitle,
  onPress,
  iconColor,
  chevronColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  iconColor: string;
  chevronColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center border-b border-border/50 py-4 active:bg-surface2/60"
    >
      <View className="mr-3 rounded-xl bg-surface2 p-2">
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="font-inter text-sm font-semibold text-text">{title}</Text>
        {subtitle ? (
          <Text className="font-inter mt-0.5 text-xs text-textSecondary">{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={chevronColor} /> : null}
    </Pressable>
  );
}

export default function RiderAccountScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { colors } = useTheme();
  const [rider, setRider] = useState<RiderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [breakdown, setBreakdown] = useState<Record<number, number>>({});
  const [uploadingId, setUploadingId] = useState(false);

  const loadRider = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("riders")
      .select("rating, wallet_balance, is_verified_id")
      .eq("id", profile.id)
      .maybeSingle();
    if (!error && data) {
      setRider(data as RiderRow);
    }

    const { data: ratings } = await supabase.from("ratings").select("rating").eq("to_user_id", profile.id);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings ?? []) {
      const s = Math.round(Number((r as { rating: number }).rating));
      if (s >= 1 && s <= 5) counts[s] = (counts[s] ?? 0) + 1;
    }
    setBreakdown(counts);

    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadRider();
  }, [loadRider]);

  const totalRated = useMemo(() => Object.values(breakdown).reduce((a, b) => a + b, 0), [breakdown]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)");
    } finally {
      setSigningOut(false);
    }
  }

  async function requestIdVerification() {
    if (!profile?.id) return;
    setUploadingId(true);
    try {
      const res = await requestRiderIdVerification();
      if (!res.ok) throw new Error(res.error ?? "Request failed");
      if (res.already_verified) {
        Alert.alert("Already verified", "Your account already shows as ID verified.");
        void loadRider();
        return;
      }
      Alert.alert(
        "Request sent",
        "Our team has been notified. They will contact you or update your account when your ID is verified."
      );
    } catch (e) {
      Alert.alert("Could not send request", e instanceof Error ? e.message : "Try again.");
    } finally {
      setUploadingId(false);
    }
  }

  const stars = rider?.rating != null ? rider.rating.toFixed(1) : "—";

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-sora-display text-2xl font-bold text-text">Account</Text>

        <Card className="mt-8 flex-row items-center gap-4">
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={56} />
          <View className="flex-1">
            <Text className="font-sora text-lg font-semibold text-text">
              {profile?.full_name ?? "Rider"}
            </Text>
            <Text className="font-inter text-sm text-textSecondary">{profile?.email}</Text>
            <Text className="font-inter mt-2 text-xs text-textSecondary">
              Rating {stars} ★ · {loading ? "…" : `$${Number(rider?.wallet_balance ?? 0).toFixed(2)} wallet`}
              {rider?.is_verified_id ? " · ID verified" : ""}
              {isStripeConfigured()
                ? " · Card trips are charged through Stripe; wallet is separate."
                : ""}
            </Text>
          </View>
        </Card>

        <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Your rating
        </Text>
        <Card>
          <Text className="font-inter text-sm text-textSecondary">
            {totalRated === 0
              ? "You do not have any passenger ratings yet. After a few trips, you will see a breakdown here."
              : "Breakdown of ratings you have received as a passenger:"}
          </Text>
          {totalRated > 0 ? (
            <View className="mt-3 gap-1">
              {[5, 4, 3, 2, 1].map((s) => (
                <View key={s} className="flex-row items-center justify-between">
                  <Text className="font-inter text-xs text-textSecondary">{s} stars</Text>
                  <Text className="font-inter text-xs text-text">{breakdown[s] ?? 0}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text className="font-inter mt-3 text-xs leading-5 text-textSecondary">
            Tips: be ready at pickup, confirm the vehicle and plate, and treat drivers respectfully — it keeps
            matching smooth for everyone.
          </Text>
        </Card>

        <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Verify your identity
        </Text>
        <Card>
          <Text className="font-inter text-sm text-textSecondary">
            Verified riders show a badge to drivers on trip requests. Tap below to open a verification request with
            our team (handled on the server — no photo library plugin required in the app).
          </Text>
          <Button
            title={rider?.is_verified_id ? "Verified" : uploadingId ? "Sending…" : "Request ID verification"}
            variant="secondary"
            className="mt-4"
            disabled={Boolean(rider?.is_verified_id) || uploadingId}
            loading={uploadingId}
            onPress={() => void requestIdVerification()}
          />
        </Card>

        <Text className="font-inter mb-2 mt-10 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Payment
        </Text>
        <Card className="p-0">
          <Row
            icon="card-outline"
            title="Payment methods"
            subtitle={
              isStripeConfigured()
                ? "Saved cards via Stripe"
                : "Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to manage cards"
            }
            onPress={() => router.push("/(rider)/payment-methods" as Href)}
            iconColor={colors.primary}
            chevronColor={colors.textMuted}
          />
        </Card>

        <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Promotions
        </Text>
        <Card className="p-0">
          <Row
            icon="pricetag-outline"
            title="Promo codes"
            subtitle="Apply codes when booking a ride"
            iconColor={colors.primary}
            chevronColor={colors.textMuted}
          />
        </Card>

        <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Settings
        </Text>
        <ColorThemePicker />
        <Card className="mt-4 p-0">
          <Row
            icon="notifications-outline"
            title="Notifications"
            subtitle="Trip and offer alerts"
            iconColor={colors.primary}
            chevronColor={colors.textMuted}
          />
          <Row
            icon="shield-checkmark-outline"
            title="Safety"
            subtitle="Share your trip from the live trip screen"
            onPress={() =>
              Alert.alert(
                "Trip sharing",
                "While a driver is assigned or your trip is in progress, tap Share trip at the top of the map (next to SOS). You can send the link by message or any app."
              )
            }
            iconColor={colors.primary}
            chevronColor={colors.textMuted}
          />
          <Row
            icon="help-circle-outline"
            title="Help"
            subtitle="Support tickets and trip issues"
            onPress={() => router.push("/(rider)/help" as Href)}
            iconColor={colors.primary}
            chevronColor={colors.textMuted}
          />
        </Card>

        <View className="mt-10">
          <Button title="Sign out" variant="ghost" loading={signingOut} onPress={() => void onSignOut()} />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
