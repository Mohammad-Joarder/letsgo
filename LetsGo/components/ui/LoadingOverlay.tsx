import { ActivityIndicator, Modal, Text, View } from "react-native";
import { useModalChrome } from "@/hooks/useModalChrome";

type Props = {
  visible: boolean;
  message?: string;
};

export function LoadingOverlay({ visible, message = "Please wait…" }: Props) {
  const chrome = useModalChrome();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-8" style={chrome.scrim}>
        <View style={chrome.dialog} className="items-center">
          <ActivityIndicator size="large" color={chrome.colors.primary} />
          <Text className="font-inter mt-4 text-center text-sm text-text">{message}</Text>
        </View>
      </View>
    </Modal>
  );
}
