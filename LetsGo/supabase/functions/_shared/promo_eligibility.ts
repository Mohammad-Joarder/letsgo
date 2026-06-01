export type PromotionRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_fare: number;
  max_discount: number;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  uses_count: number;
  per_user_limit: number;
  ride_types: string[] | null;
  is_active: boolean;
};

export function evaluatePromotionForTrip(params: {
  promo: PromotionRow;
  tripFare: number;
  rideType: string;
  now?: Date;
}): { ok: true; discount_amount: number; final_fare: number } | { ok: false; error_message: string } {
  const { promo, tripFare, rideType, now = new Date() } = params;
  if (!promo.is_active) {
    return { ok: false, error_message: "Promotion is not active." };
  }
  const vf = new Date(promo.valid_from);
  const vu = new Date(promo.valid_until);
  if (vf > now || vu < now) {
    return { ok: false, error_message: "Promotion is outside its valid dates." };
  }
  if (promo.uses_count >= promo.max_uses) {
    return { ok: false, error_message: "Promotion has reached its usage limit." };
  }
  if (tripFare < Number(promo.min_fare)) {
    return { ok: false, error_message: `Minimum fare for this code is $${Number(promo.min_fare).toFixed(2)}.` };
  }
  if (Array.isArray(promo.ride_types) && promo.ride_types.length > 0 && !promo.ride_types.includes(rideType)) {
    return { ok: false, error_message: "Not valid for this ride type." };
  }

  const cap = Number(promo.max_discount) > 0 ? Number(promo.max_discount) : Number.POSITIVE_INFINITY;
  let discount = 0;
  if (promo.discount_type === "percent") {
    discount = Math.min((tripFare * Number(promo.discount_value)) / 100, cap);
  } else {
    discount = Math.min(Number(promo.discount_value), cap);
  }
  discount = Math.round(discount * 100) / 100;
  discount = Math.min(discount, Math.max(0, tripFare));
  const finalFare = Math.max(0, Math.round((tripFare - discount) * 100) / 100);
  return { ok: true, discount_amount: discount, final_fare: finalFare };
}
