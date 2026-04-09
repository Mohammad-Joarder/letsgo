import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Href } from "expo-router";
import { signOut } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { isStripeConfigured } from "@/lib/stripeConfig";
import { supabase } from "@/lib/supabase";

type RiderRow = {
  rating: number;
  wallet_balance: number;
};

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center border-b border-border/50 py-4 active:bg-surface2/60"
    >
      <View className="mr-3 rounded-xl bg-surface2 p-2">
        <Ionicons name={icon} size={20} color="#00D4AA" />
      </View>
      <View className="flex-1">
        <Text className="font-inter text-sm font-semibold text-text">{title}</Text>
        {subtitle ? (
          <Text className="font-inter mt-0.5 text-xs text-textSecondary">{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color="#5C6678" /> : null}
    </Pressable>
  );
}

export default function RiderAccountScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [rider, setRider] = useState<RiderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadRider = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("riders")
      .select("rating, wallet_balance")
      .eq("id", profile.id)
      .maybeSingle();
    if (!error && data) {
      setRider(data as RiderRow);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadRider();
  }, [loadRider]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)");
    } finally {
      setSigningOut(false);
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
              {isStripeConfigured()
                ? " · Card trips are charged through Stripe; wallet is separate."
                : ""}
            </Text>
          </View>
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
          />
        </Card>

        <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
          Settings
        </Text>
        <Card className="p-0">
          <Row icon="notifications-outline" title="Notifications" subtitle="Trip and offer alerts" />
          <Row icon="shield-checkmark-outline" title="Safety" subtitle="Trusted contacts and trip sharing" />
          <Row icon="help-circle-outline" title="Help" subtitle="FAQs and support" />
        </Card>

        <View className="mt-10">
          <Button title="Sign out" variant="ghost" loading={signingOut} onPress={() => void onSignOut()} />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
