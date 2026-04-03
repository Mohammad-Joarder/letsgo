import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";

type Props = {
  visible: boolean;
  value: Date | null;
  onChange: (d: Date | null) => void;
  onClose: () => void;
};

export function SchedulePicker({ visible, value, onChange, onClose }: Props) {
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
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border border-border bg-surface px-6 pb-10 pt-6"
          onPress={(e) => e.stopPropagation()}
        >
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
              themeVariant="dark"
            />
          </View>

          <View className="mt-6 gap-3">
            <Button title="Confirm time" onPress={confirm} />
            <Button title="Ride now instead" variant="ghost" onPress={clear} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
