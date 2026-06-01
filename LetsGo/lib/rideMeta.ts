import type { RideType } from "@/lib/bookingTypes";

export const RIDE_TYPE_ORDER: RideType[] = ["economy", "comfort", "premium", "xl"];

export type RideMeta = {
  label: string;
  seats: number;
  estMinBase: number;
  tagline: string;
};

export const RIDE_META: Record<RideType, RideMeta> = {
  economy: {
    label: "Economy",
    seats: 4,
    estMinBase: 3,
    tagline: "Everyday rides",
  },
  comfort: {
    label: "Comfort",
    seats: 4,
    estMinBase: 4,
    tagline: "Roomier & newer",
  },
  premium: {
    label: "Premium",
    seats: 4,
    estMinBase: 5,
    tagline: "Top drivers",
  },
  xl: {
    label: "XL",
    seats: 6,
    estMinBase: 6,
    tagline: "Groups & luggage",
  },
};
