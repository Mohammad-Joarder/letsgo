import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function RiderLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { initialized, session, profile, profileLoading, configError } = useAuth();

  // Token refresh / auth events re-run profile fetch with profileLoading=true. If we already
  // know this user is a rider, keep the stack mounted — otherwise the whole group returns null
  // and navigation after "Book" shows a blank screen.
  const riderKnown = Boolean(session && profile?.role === "rider");
  const blockUntilProfileKnown = profileLoading && !riderKnown;

  useEffect(() => {
    if (!initialized || configError || blockUntilProfileKnown) return;
    if (session && profile?.role === "rider") return;
    if (segments[0] !== "(rider)") return;
    router.replace("/(auth)");
  }, [initialized, configError, blockUntilProfileKnown, session, profile?.role, segments, router]);

  if (configError || !initialized || blockUntilProfileKnown) {
    return null;
  }

  if (!session || profile?.role !== "rider") {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="searching"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
