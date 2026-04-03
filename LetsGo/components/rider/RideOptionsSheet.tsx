import { Switch, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import type { FareEstimateOption, RideType } from "@/lib/bookingTypes";
import { RIDE_TYPE_ORDER } from "@/lib/rideMeta";
import { FareBreakdown } from "@/components/rider/FareBreakdown";
import { PromoCodeInput } from "@/components/rider/PromoCodeInput";
import { RideTypeCard } from "@/components/rider/RideTypeCard";

type Props = {
  surgeActive: boolean;
  surgeMultiplier: number;
  options: FareEstimateOption[];
  distanceKm?: number;
  durationMin?: number;
  selectedRideType: RideType;
  onSelectRideType: (t: RideType) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  scheduleEnabled: boolean;
  onScheduleEnabledChange: (v: boolean) => void;
  onOpenSchedule: () => void;
  scheduledLabel: string | null;
  onPromotionResolved: (p: { id: string; code: string; discountLabel: string } | null) => void;
  booking: boolean;
  onBook: () => void;
};

export function RideOptionsSheet({
  surgeActive,
  surgeMultiplier,
  options,
  distanceKm,
  durationMin,
  selectedRideType,
  onSelectRideType,
  notes,
  onNotesChange,
  scheduleEnabled,
  onScheduleEnabledChange,
  onOpenSchedule,
  scheduledLabel,
  onPromotionResolved,
  booking,
  onBook,
}: Props) {
  const byType = Object.fromEntries(options.map((o) => [o.ride_type, o])) as Record<
    RideType,
    FareEstimateOption | undefined
  >;
  const selected = byType[selectedRideType] ?? options[0];

  return (
    <View className="pb-8 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-sora text-xl font-bold text-text">Choose a ride</Text>
        {surgeActive ? (
          <View className="rounded-full bg-orange-500/25 px-3 py-1">
            <Text className="font-inter text-xs font-bold text-orange-400">
              {surgeMultiplier.toFixed(1)}× surge
            </Text>
          </View>
        ) : null}
      </View>

      {RIDE_TYPE_ORDER.map((rt, index) => {
        const opt = byType[rt];
        if (!opt) return null;
        return (
          <RideTypeCard
            key={rt}
            option={opt}
            index={index}
            selected={selectedRideType === rt}
            durationMin={durationMin}
            onPress={() => onSelectRideType(rt)}
          />
        );
      })}

      {selected ? (
        <FareBreakdown option={selected} distanceKm={distanceKm} durationMin={durationMin} />
      ) : null}

      <PromoCodeInput
        rideType={selectedRideType}
        estimatedFare={selected?.estimated_fare ?? 0}
        onPromotionResolved={onPromotionResolved}
      />

      <View className="mt-4">
        <Text className="font-inter mb-2 text-xs font-semibold uppercase tracking-wide text-textSecondary">
          Note for driver
        </Text>
        <TextInput
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Gate code, luggage, accessibility…"
          placeholderTextColor="#5C6678"
          multiline
          numberOfLines={3}
          className="font-inter min-h-[88px] rounded-xl border border-border bg-background/90 p-3 text-sm text-text"
        />
      </View>

      <View className="mt-4 flex-row items-center justify-between rounded-xl border border-border bg-surface2/60 px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="font-inter text-sm font-semibold text-text">Schedule for later</Text>
          {scheduleEnabled && scheduledLabel ? (
            <Text className="font-inter mt-1 text-xs text-primary">{scheduledLabel}</Text>
          ) : (
            <Text className="font-inter mt-1 text-xs text-textSecondary">Off — ride starts when you book</Text>
          )}
        </View>
        <View className="flex-row items-center gap-3">
          {scheduleEnabled ? (
            <Button
              title="Edit"
              variant="secondary"
              className="min-h-[40px] min-w-[72px] px-3"
              onPress={onOpenSchedule}
            />
          ) : null}
          <Switch
            value={scheduleEnabled}
            onValueChange={(v) => {
              onScheduleEnabledChange(v);
              if (v) onOpenSchedule();
            }}
            trackColor={{ false: "#2A3548", true: "#00D4AA55" }}
            thumbColor={scheduleEnabled ? "#00D4AA" : "#8A94A6"}
          />
        </View>
      </View>

      <View className="mt-6">
        <Button
          title={
            selected
              ? `Book ${selected.ride_type} — $${selected.estimated_fare.toFixed(2)}`
              : "Book ride"
          }
          loading={booking}
          disabled={!selected}
          onPress={onBook}
        />
      </View>
    </View>
  );
}
