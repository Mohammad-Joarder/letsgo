import { CardField, useStripe } from "@stripe/stripe-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import type { RiderPaymentMethodRow } from "@/lib/riderEdge";
import { riderStripePaymentMethods } from "@/lib/riderEdge";

type Props = {
  /** Called after list refresh (e.g. attach default). */
  onMethodsChanged?: () => void;
};

export function PaymentMethodManager({ onMethodsChanged }: Props) {
  const { createPaymentMethod } = useStripe();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<RiderPaymentMethodRow[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await riderStripePaymentMethods({ action: "list" });
      if (!res.ok) throw new Error(res.error ?? "Could not load cards");
      setMethods(res.payment_methods ?? []);
      setDefaultId(res.default_payment_method_id ?? null);
      onMethodsChanged?.();
    } catch (e) {
      Alert.alert("Cards", e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [onMethodsChanged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onAddCard() {
    if (!cardComplete) {
      Alert.alert("Card", "Enter a complete card number, expiry, and CVC.");
      return;
    }
    setSaving(true);
    try {
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: "Card",
      });
      if (error) throw new Error(error.message);
      if (!paymentMethod?.id) throw new Error("No payment method returned");
      const attach = await riderStripePaymentMethods({
        action: "attach",
        payment_method_id: paymentMethod.id,
      });
      if (!attach.ok) throw new Error(attach.error ?? "Attach failed");
      const def = await riderStripePaymentMethods({
        action: "set_default",
        payment_method_id: paymentMethod.id,
      });
      if (!def.ok) throw new Error(def.error ?? "Could not set default");
      await refresh();
      Alert.alert("Saved", "Your card was added.");
      setCardComplete(false);
    } catch (e) {
      Alert.alert("Add card", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onSetDefault(id: string) {
    try {
      const res = await riderStripePaymentMethods({ action: "set_default", payment_method_id: id });
      if (!res.ok) throw new Error(res.error ?? "Failed");
      await refresh();
    } catch (e) {
      Alert.alert("Default card", e instanceof Error ? e.message : "Try again.");
    }
  }

  function onRemove(id: string, label: string) {
    Alert.alert("Remove card", `Remove ${label} ending in ${methods.find((m) => m.id === id)?.last4}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const res = await riderStripePaymentMethods({ action: "detach", payment_method_id: id });
              if (!res.ok) throw new Error(res.error ?? "Failed");
              await refresh();
            } catch (e) {
              Alert.alert("Remove card", e instanceof Error ? e.message : "Try again.");
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#00D4AA" />
      </View>
    );
  }

  return (
    <ScrollView className="max-h-[480px]" keyboardShouldPersistTaps="handled">
      {methods.length === 0 ? (
        <Text className="font-inter mb-4 text-center text-sm text-textSecondary">
          No cards saved yet. Add one below — it will be charged when you book (authorisation only until trip
          ends).
        </Text>
      ) : (
        <View className="mb-4 gap-2">
          {methods.map((m) => (
            <View
              key={m.id}
              className="flex-row items-center justify-between rounded-xl border border-border bg-surface2/80 px-4 py-3"
            >
              <View className="flex-1">
                <Text className="font-inter text-sm font-semibold capitalize text-text">
                  {m.brand} ·••• {m.last4}
                </Text>
                <Text className="font-inter text-xs text-textSecondary">
                  Exp {m.exp_month}/{m.exp_year}
                  {m.is_default || m.id === defaultId ? " · Default" : ""}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {!m.is_default && m.id !== defaultId ? (
                  <Pressable onPress={() => void onSetDefault(m.id)} className="px-2 py-1">
                    <Text className="font-inter text-xs font-semibold text-primary">Default</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => onRemove(m.id, m.brand)} className="px-2 py-1">
                  <Text className="font-inter text-xs text-error">Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="font-inter mb-2 text-xs font-bold uppercase text-textSecondary">New card</Text>
      <CardField
        postalCodeEnabled={false}
        placeholders={{ number: "4242 4242 4242 4242" }}
        cardStyle={{
          backgroundColor: "#131929",
          textColor: "#FFFFFF",
          placeholderColor: "#5C6678",
          borderWidth: 1,
          borderColor: "#1E2D45",
          borderRadius: 12,
        }}
        style={{ height: 52, marginVertical: 8 }}
        onCardChange={(d) => setCardComplete(Boolean(d.complete))}
      />
      <Button title="Save card" loading={saving} disabled={!cardComplete} onPress={() => void onAddCard()} />
    </ScrollView>
  );
}
