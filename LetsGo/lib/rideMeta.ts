import type { RideType } from "@/lib/bookingTypes";

export const RIDE_TYPE_ORDER: RideType[] = ["economy", "comfort", "premium", "xl"];

export const RIDE_META: Record<
  RideType,
  { label: string; seats: number; icon: string; estMinBase: number }
> = {
  economy: { label: "Economy", seats: 4, icon: "car-outline", estMinBase: 3 },
  comfort: { label: "Comfort", seats: 4, icon: "car-sport-outline", estMinBase: 4 },
  premium: { label: "Premium", seats: 4, icon: "diamond-outline", estMinBase: 5 },
  xl: { label: "XL", seats: 6, icon: "people-outline", estMinBase: 6 },
};
