import type { Href } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Do not use <Redirect /> here: expo-router's Redirect runs on useFocusEffect and can
 * trigger router.replace in a tight loop ("Maximum update depth exceeded").
 */
export default function AuthGroupLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, profileLoading, driverApproval, initialized, configError } = useAuth();
  const pendingHref = useRef<string | null>(null);

  useEffect(() => {
    if (!initialized || configError || profileLoading) return;

    const group = segments[0] as string | undefined;
    const leaf = segments[1] as string | undefined;

    if (!session) {
      pendingHref.current = null;
      return;
    }

    const nav = (href: Href) => {
      const key = String(href);
      if (pendingHref.current === key) return;
      pendingHref.current = key;
      router.replace(href);
    };

    if (profile?.role === "rider") {
      if (group === "(rider)") {
        pendingHref.current = null;
        return;
      }
      nav("/(rider)/(tabs)/home" as Href);
      return;
    }

    if (profile?.role === "driver") {
      if (driverApproval === "approved") {
        if (group === "(driver)") {
          pendingHref.current = null;
          return;
        }
        nav("/(driver)/(tabs)/home" as Href);
        return;
      }
      if (leaf === "driver-review-pending") {
        pendingHref.current = null;
        return;
      }
      nav("/(auth)/driver-review-pending");
      return;
    }

    if (profile?.role === "admin") {
      if (leaf === "admin-only") {
        pendingHref.current = null;
        return;
      }
      nav("/(auth)/admin-only");
      return;
    }

    if (!profile) {
      if (leaf === "role-select") {
        pendingHref.current = null;
        return;
      }
      nav("/(auth)/role-select");
    }
  }, [
    initialized,
    configError,
    profileLoading,
    session,
    profile?.role,
    profile,
    driverApproval,
    segments,
    router,
  ]);

  if (configError || !initialized) {
    return null;
  }

  if (session && profileLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
        animation: "fade",
      }}
    />
  );
}
