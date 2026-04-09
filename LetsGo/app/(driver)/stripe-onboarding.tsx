import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { createConnectAccount } from "@/lib/driverEdge";

WebBrowser.maybeCompleteAuthSession();

export default function DriverStripeOnboardingScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = Linking.createURL("stripe-connect-return");

  const openStripe = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await createConnectAccount();
      if (!res.ok || !res.onboarding_url) {
        throw new Error(res.error ?? "Could not start Stripe onboarding");
      }
      const result = await WebBrowser.openAuthSessionAsync(res.onboarding_url, returnUrl);
      await refreshProfile();
      if (result.type === "success") {
        router.replace("/(driver)/(tabs)/home");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [returnUrl, refreshProfile, router]);

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-6 pt-8">
        <Text className="font-sora-display text-2xl font-bold text-text">Payouts</Text>
        <Text className="font-inter mt-2 text-sm leading-6 text-textSecondary">
          Connect a Stripe Express account so Lets Go can transfer your earnings. Stripe hosts
          onboarding — you will verify identity and bank details there.
        </Text>

        <Card className="mt-8">
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">
            Return URL
          </Text>
          <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
            Set Supabase Edge secret{" "}
            <Text className="text-text">STRIPE_CONNECT_RETURN_URL</Text> to this value (and the same in
            Stripe Dashboard if you restrict redirect URLs):
          </Text>
          <Text selectable className="font-mono mt-2 text-xs text-primary">
            {returnUrl}
          </Text>
        </Card>

        {error ? (
          <Text className="font-inter mt-4 text-sm text-error">{error}</Text>
        ) : null}

        <View className="mt-10 gap-3">
          <Button title="Continue with Stripe" loading={loading} onPress={() => void openStripe()} />
          <Button
            title="I finished onboarding — refresh"
            variant="ghost"
            disabled={loading}
            onPress={() => void refreshProfile()}
          />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
