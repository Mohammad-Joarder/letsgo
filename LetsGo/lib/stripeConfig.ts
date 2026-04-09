import Constants from "expo-constants";

export function getStripePublishableKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripePublishableKey());
}

export function allowCashBookingDemo(): boolean {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.EXPO_PUBLIC_ALLOW_CASH_BOOKING === "true";
}
