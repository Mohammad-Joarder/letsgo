import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { RideType } from "@/lib/bookingTypes";
import { supabase } from "@/lib/supabase";

type Props = {
  rideType: RideType;
  estimatedFare: number;
  onPromotionResolved: (promo: { id: string; code: string; discountLabel: string } | null) => void;
};

export function PromoCodeInput({ rideType, estimatedFare, onPromotionResolved }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; label: string } | null>(null);

  async function validate() {
    const trimmed = code.trim().toUpperCase();
    setMessage(null);
    onPromotionResolved(null);
    setApplied(null);
    if (!trimmed) {
      setMessage("Enter a promo code.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("code", trimmed)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setMessage("Code not found or inactive.");
        return;
      }

      const now = new Date();
      if (new Date(data.valid_from) > now || new Date(data.valid_until) < now) {
        setMessage("This promotion is not valid right now.");
        return;
      }
      if (data.uses_count >= data.max_uses) {
        setMessage("This promotion has reached its usage limit.");
        return;
      }
      if (Array.isArray(data.ride_types) && data.ride_types.length > 0) {
        if (!data.ride_types.includes(rideType)) {
          setMessage("Not valid for this ride type.");
          return;
        }
      }
      if (estimatedFare < Number(data.min_fare)) {
        setMessage(`Minimum fare for this code is $${Number(data.min_fare).toFixed(2)}.`);
        return;
      }

      const label =
        data.discount_type === "percent"
          ? `${Number(data.discount_value)}% off`
          : `$${Number(data.discount_value).toFixed(2)} off`;

      setApplied({ code: trimmed, label });
      onPromotionResolved({ id: data.id, code: trimmed, discountLabel: label });
      setMessage("Applied.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not validate code.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setCode("");
    setMessage(null);
    setApplied(null);
    onPromotionResolved(null);
  }

  return (
    <View className="mt-4">
      <Text className="font-inter mb-2 text-xs font-semibold uppercase tracking-wide text-textSecondary">
        Promo code
      </Text>
      <View className="flex-row gap-2">
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setMessage(null);
          }}
          placeholder="ENTER CODE"
          placeholderTextColor="#5C6678"
          autoCapitalize="characters"
          editable={!applied}
          className="font-inter h-12 flex-1 rounded-xl border border-border bg-background/90 px-4 text-sm text-text"
        />
        {applied ? (
          <Pressable
            onPress={clear}
            className="h-12 items-center justify-center rounded-xl border border-border px-4 active:opacity-80"
          >
            <Text className="font-inter text-sm font-semibold text-primary">Clear</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void validate()}
            disabled={loading}
            className="h-12 min-w-[88px] items-center justify-center rounded-xl bg-primary/20 px-4 active:opacity-80"
          >
            {loading ? (
              <ActivityIndicator color="#00D4AA" />
            ) : (
              <Text className="font-inter text-sm font-semibold text-primary">Apply</Text>
            )}
          </Pressable>
        )}
      </View>
      {applied ? (
        <Text className="font-inter mt-2 text-xs text-primary">
          {applied.code} — {applied.label}
        </Text>
      ) : null}
      {message && !applied ? (
        <Text
          className={`font-inter mt-2 text-xs ${message === "Applied." ? "text-primary" : "text-error"}`}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
