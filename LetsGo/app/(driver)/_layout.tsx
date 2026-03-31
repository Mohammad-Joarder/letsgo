import React from "react";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONTS } from "@/lib/constants";

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🚗" label="Drive" /> }} />
      <Tabs.Screen name="earnings" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="💰" label="Earnings" /> }} />
      <Tabs.Screen name="account" options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="👤" label="Account" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: "center", gap: 3 },
  tabIcon: { fontSize: 22, opacity: 0.45 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontFamily: FONTS.interMedium, fontSize: 10, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primary },
});
