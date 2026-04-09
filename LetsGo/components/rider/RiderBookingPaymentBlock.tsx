import { CardField, useStripe } from "@stripe/stripe-react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { RiderPaymentMethodRow } from "@/lib/riderEdge";
import { createPaymentIntent, riderStripePaymentMethods } from "@/lib/riderEdge";
import { allowCashBookingDemo, isStripeConfigured } from "@/lib/stripeConfig";

export type PayMode = "card" | "cash";

export type RiderBookingPaymentHandle = {
  authorizeForBooking: () => Promise<{ stripe_payment_intent_id: string }>;
};

type Props = {
  fareAud: number;
  payMode: PayMode;
  onPayModeChange: (m: PayMode) => void;
  onReadinessChange: (ok: boolean) => void;
};

export const RiderBookingPaymentBlock = forwardRef<RiderBookingPaymentHandle, Props>(
  function RiderBookingPaymentBlock({ fareAud, payMode, onPayModeChange, onReadinessChange }, ref) {
    const router = useRouter();
    const { confirmPayment } = useStripe();
    const stripeOn = isStripeConfigured();
    const cashOk = allowCashBookingDemo();

    const [methods, setMethods] = useState<RiderPaymentMethodRow[]>([]);
    const [defaultId, setDefaultId] = useState<string | null>(null);
    const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
    const [useNewCard, setUseNewCard] = useState(false);
    const [cardComplete, setCardComplete] = useState(false);
    const [listLoading, setListLoading] = useState(false);

    const refreshList = useCallback(async () => {
      if (!stripeOn || payMode !== "card") return;
      setListLoading(true);
      try {
        const res = await riderStripePaymentMethods({ action: "list" });
        if (res.ok && res.payment_methods) {
          const list = res.payment_methods;
          setMethods(list);
          setDefaultId(res.default_payment_method_id ?? null);
          const def = list.find((m) => m.is_default)?.id ?? res.default_payment_method_id;
          setSelectedPmId((prev) => prev ?? def ?? list[0]?.id ?? null);
        }
      } finally {
        setListLoading(false);
      }
    }, [stripeOn, payMode]);

    useEffect(() => {
      void refreshList();
    }, [refreshList]);

    useEffect(() => {
      if (payMode === "cash" && cashOk) {
        onReadinessChange(true);
        return;
      }
      if (payMode === "card" && stripeOn) {
        if (useNewCard) {
          onReadinessChange(cardComplete);
        } else {
          onReadinessChange(Boolean(selectedPmId));
        }
        return;
      }
      if (payMode === "card" && !stripeOn) {
        onReadinessChange(false);
        return;
      }
      onReadinessChange(false);
    }, [payMode, cashOk, stripeOn, useNewCard, cardComplete, selectedPmId, onReadinessChange]);

    const authorizeForBooking = useCallback(async (): Promise<{ stripe_payment_intent_id: string }> => {
      const amountCents = Math.max(50, Math.round(fareAud * 100));

      if (useNewCard) {
        const piRes = await createPaymentIntent({ amount_cents: amountCents });
        if (!piRes.ok || !piRes.client_secret || !piRes.payment_intent_id) {
          throw new Error(piRes.error ?? "Could not start payment");
        }
        const { error, paymentIntent } = await confirmPayment(piRes.client_secret, {
          paymentMethodType: "Card",
        });
        if (error) throw new Error(error.message);
        const id = paymentIntent?.id ?? piRes.payment_intent_id;
        return { stripe_payment_intent_id: id };
      }

      if (!selectedPmId) throw new Error("Select a saved card or use a new card.");

      const piRes = await createPaymentIntent({
        amount_cents: amountCents,
        payment_method_id: selectedPmId,
      });
      if (!piRes.ok || !piRes.client_secret || !piRes.payment_intent_id) {
        throw new Error(piRes.error ?? "Could not start payment");
      }
      const { error } = await confirmPayment(piRes.client_secret, {
        paymentMethodType: "Card",
        paymentMethodData: { paymentMethodId: selectedPmId },
      });
      if (error) throw new Error(error.message);
      return { stripe_payment_intent_id: piRes.payment_intent_id };
    }, [fareAud, useNewCard, selectedPmId, confirmPayment]);

    useImperativeHandle(ref, () => ({ authorizeForBooking }), [authorizeForBooking]);

    return (
      <View className="mb-5 rounded-2xl border border-border/80 bg-surface2/40 px-3 py-3">
        <Text className="font-inter text-xs font-bold uppercase tracking-wide text-textSecondary">
          Payment
        </Text>

        {cashOk ? (
          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={() => onPayModeChange("card")}
              className={`flex-1 items-center rounded-xl border py-2 ${payMode === "card" ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <Text className="font-inter text-xs font-semibold text-text">Card</Text>
            </Pressable>
            <Pressable
              onPress={() => onPayModeChange("cash")}
              className={`flex-1 items-center rounded-xl border py-2 ${payMode === "cash" ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <Text className="font-inter text-xs font-semibold text-text">Cash (demo)</Text>
            </Pressable>
          </View>
        ) : null}

        {payMode === "cash" && cashOk ? (
          <Text className="font-inter mt-2 text-xs text-textSecondary">
            No card authorisation — for development only. Configure Stripe for production card bookings.
          </Text>
        ) : null}

        {payMode === "card" && !stripeOn ? (
          <Text className="font-inter mt-2 text-xs text-accent">
            Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to book with a card, or enable cash demo in .env.
          </Text>
        ) : null}

        {payMode === "card" && stripeOn ? (
          <>
            <Pressable
              onPress={() => void refreshList()}
              className="mt-2 self-end active:opacity-70"
              disabled={listLoading}
            >
              <Text className="font-inter text-xs text-primary">Refresh cards</Text>
            </Pressable>

            {!useNewCard ? (
              <View className="mt-2 gap-2">
                {methods.length === 0 ? (
                  <Text className="font-inter text-xs text-textSecondary">
                    No saved cards. Use a new card below or manage cards in Account.
                  </Text>
                ) : (
                  methods.map((m) => {
                    const on = selectedPmId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setSelectedPmId(m.id)}
                        className={`rounded-xl border px-3 py-2 ${on ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <Text className="font-inter text-sm capitalize text-text">
                          {m.brand} ·••• {m.last4}
                          {m.is_default || m.id === defaultId ? " · Default" : ""}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
                <Pressable onPress={() => setUseNewCard(true)} className="py-1">
                  <Text className="font-inter text-xs font-semibold text-primary">Pay with a new card</Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-2">
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
                  style={{ height: 50, marginVertical: 6 }}
                  onCardChange={(d) => setCardComplete(Boolean(d.complete))}
                />
                <Pressable onPress={() => setUseNewCard(false)} className="py-1">
                  <Text className="font-inter text-xs text-textSecondary">Use saved card instead</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              onPress={() => router.push("/(rider)/payment-methods" as Href)}
              className="mt-2 border-t border-border/60 pt-2"
            >
              <Text className="font-inter text-center text-xs font-semibold text-primary">
                Manage cards in Account
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }
);
