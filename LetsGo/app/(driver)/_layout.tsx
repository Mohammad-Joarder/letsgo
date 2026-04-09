import type { Href } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DriverLayout() {
  const router = useRouter();
  const segments = useSegments();
  const {
    initialized,
    session,
    profile,
    profileLoading,
    driverApproval,
    driverStripeConnectOnboarded,
    configError,
  } = useAuth();

  const driverGateOk =
    Boolean(session) &&
    profile?.role === "driver" &&
    driverApproval === "approved";
  const blockUntilProfileKnown = profileLoading && !driverGateOk;

  const onStripeOnboarding = (segments as string[]).includes("stripe-onboarding");

  useEffect(() => {
    if (!initialized || configError || blockUntilProfileKnown) return;

    if (!session) {
      if (segments[0] !== "(driver)") return;
      router.replace("/(auth)");
      return;
    }

    if (profile?.role !== "driver" || driverApproval !== "approved") {
      const group = segments[0] as string | undefined;
      const leaf = segments[1] as string | undefined;
      if (group === "(auth)" && leaf === "driver-review-pending") return;
      if (group !== "(driver)") return;
      router.replace("/(auth)/driver-review-pending");
      return;
    }

    if (driverStripeConnectOnboarded === false && !onStripeOnboarding) {
      router.replace("/(driver)/stripe-onboarding" as Href);
      return;
    }
    if (driverStripeConnectOnboarded === true && onStripeOnboarding) {
      router.replace("/(driver)/(tabs)/home" as Href);
    }
  }, [
    initialized,
    configError,
    blockUntilProfileKnown,
    session,
    profile?.role,
    driverApproval,
    driverStripeConnectOnboarded,
    onStripeOnboarding,
    segments,
    router,
  ]);

  if (configError || !initialized || blockUntilProfileKnown) {
    return null;
  }

  if (!session || profile?.role !== "driver" || driverApproval !== "approved") {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="stripe-onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pickup-navigation" />
      <Stack.Screen name="trip-active" />
      <Stack.Screen name="trip-summary" />
    </Stack>
  );
}
