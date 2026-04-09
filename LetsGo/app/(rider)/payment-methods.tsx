import { useRouter } from "expo-router";
import { PaymentMethodManager } from "@/components/rider/PaymentMethodManager";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { isStripeConfigured } from "@/lib/stripeConfig";
import { Text, View } from "react-native";

export default function RiderPaymentMethodsScreen() {
  const router = useRouter();

  if (!isStripeConfigured()) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 justify-center bg-background px-6">
          <Text className="font-inter text-center text-sm text-textSecondary">
            Add <Text className="text-text">EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY</Text> to your{" "}
            <Text className="text-text">.env</Text>, run <Text className="text-text">npx expo start</Text>{" "}
            with a clean cache if needed, then return here.
          </Text>
          <View className="mt-6">
            <Button title="Go back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-4 pt-2">
        <Text className="font-inter mb-4 text-sm text-textSecondary">
          Cards are stored with Stripe. The fare is authorised when you book; it is captured when the trip
          completes.
        </Text>
        <PaymentMethodManager />
      </View>
    </SafeAreaWrapper>
  );
}
