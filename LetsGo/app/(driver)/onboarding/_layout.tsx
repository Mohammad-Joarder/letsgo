import { Stack } from "expo-router";

export default function DriverOnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
        animation: "slide_from_right",
      }}
    />
  );
}
