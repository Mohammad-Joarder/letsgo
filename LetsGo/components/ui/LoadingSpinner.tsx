import { ActivityIndicator, Text, View } from "react-native";

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-8">
      <ActivityIndicator size="large" color="#00D4AA" />
      {label ? <Text className="font-inter text-sm text-textSecondary">{label}</Text> : null}
    </View>
  );
}
