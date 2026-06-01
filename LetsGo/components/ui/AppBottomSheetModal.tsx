import type { ReactNode } from "react";
import { Modal, Pressable, View, type ViewStyle } from "react-native";
import { useModalChrome } from "@/hooks/useModalChrome";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra styles on the sheet panel (e.g. maxHeight). */
  sheetStyle?: ViewStyle;
  animationType?: "none" | "slide" | "fade";
};

/**
 * Themed bottom sheet: strong scrim + solid elevated surface (readable in light & dark).
 */
export function AppBottomSheetModal({
  visible,
  onClose,
  children,
  sheetStyle,
  animationType = "slide",
}: Props) {
  const chrome = useModalChrome();

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={chrome.scrim}>
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={[chrome.sheet, sheetStyle]}>
          <View style={chrome.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}
