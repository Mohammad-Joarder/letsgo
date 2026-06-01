import type { Href } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

function unapprovedDriverAllowedRoot(root: string | undefined): boolean {
  return (
    root === "onboarding-status" ||
    root === "onboarding" ||
    root === "application-rejected" ||
    root === "suspended-notice" ||
    root === "help" ||
    root === "account"
  );
}

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
    driverStripeGateSuppressedUntil,
    configError,
  } = useAuth();
  const { colors } = useTheme();

  const blockUntilProfileKnown = Boolean(session) && profileLoading;
  const onStripeOnboarding = (segments as string[]).includes("stripe-onboarding");
  const stripeGateSuppressed =
    driverStripeGateSuppressedUntil != null && Date.now() < driverStripeGateSuppressedUntil;

  const rootSeg = segments[1] as string | undefined;

  useEffect(() => {
    if (!initialized || configError || blockUntilProfileKnown) return;

    if (!session) {
      if (segments[0] !== "(driver)") return;
      router.replace("/(auth)");
      return;
    }

    if (profile?.role !== "driver") {
      if (segments[0] !== "(driver)") return;
      router.replace("/(auth)");
      return;
    }

    const ap = driverApproval;
    if (!ap) return;

    if (ap !== "approved") {
      if (ap === "rejected" && rootSeg !== "application-rejected") {
        router.replace("/(driver)/application-rejected" as Href);
        return;
      }
      if (ap === "suspended" && rootSeg !== "suspended-notice") {
        router.replace("/(driver)/suspended-notice" as Href);
        return;
      }
      if ((ap === "pending" || ap === "under_review") && !unapprovedDriverAllowedRoot(rootSeg)) {
        router.replace("/(driver)/onboarding-status" as Href);
      }
      return;
    }

    // Approved — block stragglers on onboarding shell
    if (rootSeg === "onboarding" || rootSeg === "onboarding-status") {
      router.replace("/(driver)/(tabs)/home" as Href);
      return;
    }

    if (driverStripeConnectOnboarded === false && !onStripeOnboarding && !stripeGateSuppressed) {
      router.replace("/(driver)/stripe-onboarding" as Href);
      return;
    }
  }, [
    initialized,
    configError,
    blockUntilProfileKnown,
    session,
    profile?.role,
    driverApproval,
    driverStripeConnectOnboarded,
    driverStripeGateSuppressedUntil,
    stripeGateSuppressed,
    onStripeOnboarding,
    segments,
    router,
    rootSeg,
  ]);

  if (configError || !initialized || blockUntilProfileKnown) {
    return null;
  }

  if (!session || profile?.role !== "driver") {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="onboarding-status" />
      <Stack.Screen name="application-rejected" />
      <Stack.Screen name="suspended-notice" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="stripe-onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pickup-navigation" />
      <Stack.Screen name="trip-active" />
      <Stack.Screen name="trip-summary" />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen
        name="account/vehicles"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
