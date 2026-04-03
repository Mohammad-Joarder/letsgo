import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DriverLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { initialized, session, profile, profileLoading, driverApproval, configError } = useAuth();

  useEffect(() => {
    if (!initialized || configError || profileLoading) return;

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
    }
  }, [
    initialized,
    configError,
    profileLoading,
    session,
    profile?.role,
    driverApproval,
    segments,
    router,
  ]);

  if (configError || !initialized || profileLoading) {
    return null;
  }

  if (!session || profile?.role !== "driver" || driverApproval !== "approved") {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#131929",
          borderTopColor: "#1E2D45",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#00D4AA",
        tabBarInactiveTintColor: "#8A94A6",
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
