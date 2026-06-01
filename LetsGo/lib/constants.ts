import type { ride_type } from "./types";
import { COLORS_DARK } from "./colors";

/** @deprecated Prefer useTheme().colors for theme-aware values */
export const COLORS = COLORS_DARK;

export const RIDE_TYPES: {
  id: ride_type;
  label: string;
  description: string;
  seats: number;
}[] = [
  { id: "economy", label: "Economy", description: "Affordable everyday rides", seats: 4 },
  { id: "comfort", label: "Comfort", description: "Extra space & newer cars", seats: 4 },
  { id: "premium", label: "Premium", description: "Top-rated drivers", seats: 4 },
  { id: "xl", label: "XL", description: "Groups & extra luggage", seats: 6 },
];

export const APP_TAGLINE = "Get there, your way.";

/** Matches on-logo tagline — use on welcome / marketing surfaces. */
export const BRAND_TAGLINE = "Ride Smart. Pay Less.";
