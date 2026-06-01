import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from "react-native";

export const NUMERIC_INPUT_ACCESSORY_ID = "letsgo-numeric-done";

/** iOS toolbar above number-pad keyboards so users can dismiss and see the Continue button. */
export function NumericKeyboardToolbar() {
  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_INPUT_ACCESSORY_ID}>
      <View className="flex-row items-center justify-end border-t border-border bg-surface2 px-4 py-2">
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} className="px-2 py-1">
          <Text className="font-inter text-base font-semibold text-primary">Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
