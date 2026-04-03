import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { FareEstimateOption } from "@/lib/bookingTypes";

type Props = {
  option: FareEstimateOption | null;
  distanceKm?: number;
  durationMin?: number;
};

export function FareBreakdown({ option, distanceKm, durationMin }: Props) {
  const [open, setOpen] = useState(false);

  if (!option) return null;

  return (
    <View className="mt-2 overflow-hidden rounded-2xl border border-border/80 bg-surface2/80">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between px-4 py-3 active:bg-surface/60"
      >
        <Text className="font-inter text-sm font-semibold text-text">Fare breakdown</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#8A94A6" />
      </Pressable>
      {open ? (
        <View className="border-t border-border/60 px-4 pb-4 pt-2">
          {distanceKm != null ? (
            <Row label="Trip distance" value={`${distanceKm.toFixed(1)} km`} />
          ) : null}
          {durationMin != null ? <Row label="Est. time" value={`${durationMin} min`} /> : null}
          <Row label="Base fare" value={formatAud(option.base_fare)} />
          <Row label="Distance" value={formatAud(option.distance_fare)} />
          <Row label="Time" value={formatAud(option.time_fare)} />
          <Row label="Minimum applied" value={option.subtotal_pre_minimum < option.minimum_fare ? "Yes" : "No"} />
          <Row label="Before surge" value={formatAud(option.fare_pre_surge)} />
          {option.surge_multiplier > 1 ? (
            <Row label="Surge multiplier" value={`${option.surge_multiplier.toFixed(1)}×`} />
          ) : null}
          <Row label="Platform fee" value={`${formatAud(option.platform_fee)} (${(option.platform_fee_percent * 100).toFixed(0)}%)`} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="font-inter text-xs text-textSecondary">{label}</Text>
      <Text className="font-inter text-xs font-medium text-text">{value}</Text>
    </View>
  );
}

function formatAud(n: number) {
  return `$${n.toFixed(2)}`;
}
