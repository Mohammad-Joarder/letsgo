import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  baseFare: number | null | undefined;
  distanceFare: number | null | undefined;
  timeFare: number | null | undefined;
  platformFee: number | null | undefined;
  surgeMultiplier?: number | null;
  chargedTotal: number;
};

function aud(n: number) {
  return `$${n.toFixed(2)}`;
}

export function CompletedTripFareBreakdown({
  baseFare,
  distanceFare,
  timeFare,
  platformFee,
  surgeMultiplier,
  chargedTotal,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasLines =
    baseFare != null || distanceFare != null || timeFare != null || platformFee != null;

  if (!hasLines) {
    return (
      <View className="mt-2 rounded-2xl border border-border/80 bg-surface2/80 px-4 py-3">
        <Text className="font-inter text-sm text-textSecondary">Total charged</Text>
        <Text className="font-sora mt-1 text-2xl font-bold text-text">{aud(chargedTotal)}</Text>
      </View>
    );
  }

  return (
    <View className="mt-2 overflow-hidden rounded-2xl border border-border/80 bg-surface2/80">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between px-4 py-3 active:bg-surface/60"
      >
        <View>
          <Text className="font-inter text-sm font-semibold text-text">Fare breakdown</Text>
          <Text className="font-sora mt-0.5 text-lg font-bold text-text">{aud(chargedTotal)}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color="#8A94A6" />
      </Pressable>
      {open ? (
        <View className="border-t border-border/60 px-4 pb-4 pt-2">
          {baseFare != null ? <Row label="Base fare" value={aud(Number(baseFare))} /> : null}
          {distanceFare != null ? <Row label="Distance" value={aud(Number(distanceFare))} /> : null}
          {timeFare != null ? <Row label="Time" value={aud(Number(timeFare))} /> : null}
          {surgeMultiplier != null && surgeMultiplier > 1 ? (
            <Row label="Surge" value={`${Number(surgeMultiplier).toFixed(1)}×`} />
          ) : null}
          {platformFee != null ? <Row label="Platform fee" value={aud(Number(platformFee))} /> : null}
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
