import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  visible: boolean;
  value: Date | null;
  onChange: (d: Date | null) => void;
  onClose: () => void;
};

export function SchedulePicker({ visible, value, onChange, onClose }: Props) {
  const { colorTheme } = useTheme();
  const [temp, setTemp] = useState(value ?? new Date(Date.now() + 60 * 60 * 1000));

  if (!visible) return null;

  const onPick = (_: DateTimePickerEvent, d?: Date) => {
    if (d) setTemp(d);
  };

  function confirm() {
    if (temp.getTime() <= Date.now()) {
      return;
    }
    onChange(temp);
    onClose();
  }

  function clear() {
    onChange(null);
    onClose();
  }

  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} animationType="fade">
      <View className="px-6 pb-10">
        <Text className="font-sora text-lg font-semibold text-text">Schedule ride</Text>
        <Text className="font-inter mt-1 text-sm text-textSecondary">
          Choose a pickup time at least 15 minutes from now.
        </Text>

        <View className="mt-6 items-center">
          <DateTimePicker
            value={temp}
            mode="datetime"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={new Date(Date.now() + 15 * 60 * 1000)}
            onChange={onPick}
            themeVariant={colorTheme}
          />
        </View>

        <View className="mt-6 gap-3">
          <Button title="Confirm time" onPress={confirm} />
          <Button title="Ride now instead" variant="ghost" onPress={clear} />
        </View>
      </View>
    </AppBottomSheetModal>
  );
}
