import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { RideType } from "@/lib/bookingTypes";
import { validatePromoCode } from "@/lib/riderEdge";
import { useAuth } from "@/hooks/useAuth";

export type ResolvedPromotion = {
  id: string;
  code: string;
  discountLabel: string;
  discountAmount: number;
  finalFare: number;
};

type Props = {
  rideType: RideType;
  /** Fare before promo (quote from fare estimate). */
  estimatedFare: number;
  onPromotionResolved: (promo: ResolvedPromotion | null) => void;
};

export function PromoCodeInput({ rideType, estimatedFare, onPromotionResolved }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState<ResolvedPromotion | null>(null);

  async function validate() {
    const trimmed = code.trim().toUpperCase();
    setMessage(null);
    onPromotionResolved(null);
    setApplied(null);
    if (!trimmed) {
      setMessage("Enter a promo code.");
      return;
    }
    if (!user?.id) {
      setMessage("Sign in to use a promo code.");
      return;
    }
    if (!Number.isFinite(estimatedFare) || estimatedFare <= 0) {
      setMessage("Fare not ready — wait for the estimate.");
      return;
    }
    setLoading(true);
    try {
      const res = await validatePromoCode({
        code: trimmed,
        rider_id: user.id,
        trip_fare: estimatedFare,
        ride_type: rideType,
      });
      if (!res || typeof res !== "object") {
        setMessage("Unexpected response.");
        return;
      }
      if (!("ok" in res) || res.ok === false) {
        const msg =
          (res as { error_message?: string }).error_message ??
          (res as { error?: string }).error ??
          "Code could not be applied.";
        setMessage(msg);
        return;
      }
      if (!res.valid) {
        setMessage("This code cannot be applied.");
        return;
      }
      const discount = res.discount_amount ?? 0;
      const finalFare = res.final_fare ?? Math.max(0, estimatedFare - discount);
      const label =
        discount > 0 && discount < estimatedFare
          ? `$${discount.toFixed(2)} off`
          : discount >= estimatedFare
            ? "Free ride"
            : "Discount";

      const resolved: ResolvedPromotion = {
        id: String(res.promo_id),
        code: trimmed,
        discountLabel: label,
        discountAmount: discount,
        finalFare,
      };
      setApplied(resolved);
      onPromotionResolved(resolved);
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
          {applied.code} — {applied.discountLabel} · You pay ${applied.finalFare.toFixed(2)}
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
