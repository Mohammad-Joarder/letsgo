import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function RiderLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { initialized, session, profile, profileLoading, configError } = useAuth();

  useEffect(() => {
    if (!initialized || configError || profileLoading) return;
    if (session && profile?.role === "rider") return;
    if (segments[0] !== "(rider)") return;
    router.replace("/(auth)");
  }, [initialized, configError, profileLoading, session, profile?.role, segments, router]);

  if (configError || !initialized || profileLoading) {
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
