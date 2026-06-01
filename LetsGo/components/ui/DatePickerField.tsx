import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { formatIsoDateLocal, parseIsoDateLocal, todayLocal } from "@/lib/documentExpiry";

export type DatePickerFieldProps = {
  label: string;
  /** Stored as YYYY-MM-DD (same format as existing onboarding saves). */
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** When there is no value, which bound to show first in the picker (e.g. `max` for "first issued" caps). */
  defaultEmptyPicker?: "min" | "max";
  placeholder?: string;
  /** When true, user can clear the date (e.g. optional vehicle registration expiry). */
  optional?: boolean;
};

function formatDisplayDate(iso: string): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function clampDate(d: Date, minD: Date, maxD?: Date): Date {
  if (d < minD) return minD;
  if (maxD && d > maxD) return maxD;
  return d;
}

function pickerDateFromValue(
  value: string,
  minD: Date,
  maxD: Date | undefined,
  defaultEmpty: "min" | "max"
): Date {
  const parsed = parseIsoDateLocal(value);
  if (parsed) return clampDate(parsed, minD, maxD);
  if (defaultEmpty === "max" && maxD) return maxD;
  return minD;
}

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  defaultEmptyPicker = "min",
  placeholder = "Select date",
  optional = false,
}: DatePickerFieldProps) {
  const { colorTheme } = useTheme();
  const minDate = minimumDate ?? todayLocal();
  const maxDate = maximumDate;
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [temp, setTemp] = useState(() => pickerDateFromValue(value, minDate, maxDate, defaultEmptyPicker));

  const minIso = useMemo(() => formatIsoDateLocal(minDate), [minDate]);
  const maxIso = useMemo(() => (maxDate ? formatIsoDateLocal(maxDate) : undefined), [maxDate]);

  useEffect(() => {
    if (!iosOpen && !androidOpen) {
      setTemp(pickerDateFromValue(value, minDate, maxDate, defaultEmptyPicker));
    }
  }, [value, minDate, maxDate, defaultEmptyPicker, iosOpen, androidOpen]);

  function commitDate(d: Date) {
    onChange(formatIsoDateLocal(clampDate(d, minDate, maxDate)));
  }

  function onNativeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setAndroidOpen(false);
      if (event.type === "dismissed" || !selected) return;
      commitDate(selected);
      return;
    }
    if (selected) setTemp(selected);
  }

  function openPicker() {
    setTemp(pickerDateFromValue(value, minDate, maxDate, defaultEmptyPicker));
    if (Platform.OS === "ios") {
      setIosOpen(true);
      return;
    }
    if (Platform.OS === "android") {
      setAndroidOpen(true);
      return;
    }
    // Web handled by native <input type="date" /> below
  }

  const display = value ? formatDisplayDate(value) : "";

  if (Platform.OS === "web") {
    return (
      <View className="mb-4">
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">{label}</Text>
        <input
          type="date"
          min={minIso}
          max={maxIso}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: 16,
            border: "1px solid var(--color-border, #2A3142)",
            padding: "0 16px",
            fontSize: 16,
            fontFamily: "Inter, system-ui, sans-serif",
            background: "var(--color-surface2, #141824)",
            color: "var(--color-text, #E8ECF2)",
            boxSizing: "border-box",
          }}
        />
        {!value && optional ? (
          <Text className="font-inter mt-1 text-xs text-textMuted">Optional</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display || placeholder}`}
        className="font-inter min-h-[52px] justify-center rounded-2xl border border-border bg-surface2 px-4"
      >
        <Text className={`text-base ${display ? "text-text" : "text-textMuted"}`}>
          {display || placeholder}
        </Text>
      </Pressable>
      {optional && !value ? (
        <Text className="font-inter mt-1 text-xs text-textMuted">Optional</Text>
      ) : null}

      {Platform.OS === "android" && androidOpen ? (
        <DateTimePicker
          value={temp}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={onNativeChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <AppBottomSheetModal visible={iosOpen} onClose={() => setIosOpen(false)}>
          <View className="px-6 pb-10">
            <Text className="font-sora text-lg font-semibold text-text">{label}</Text>
            <View className="mt-6 items-center">
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                maximumDate={maxDate}
                onChange={onNativeChange}
                themeVariant={colorTheme}
              />
            </View>
            <View className="mt-6 gap-3">
              <Button
                title="Confirm"
                onPress={() => {
                  commitDate(temp);
                  setIosOpen(false);
                }}
              />
              {optional ? (
                <Button
                  title="Clear date"
                  variant="ghost"
                  onPress={() => {
                    onChange("");
                    setIosOpen(false);
                  }}
                />
              ) : null}
            </View>
          </View>
        </AppBottomSheetModal>
      ) : null}
    </View>
  );
}
