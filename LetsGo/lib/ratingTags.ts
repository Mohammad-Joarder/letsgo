/** Phase 6 — allowed rating tag chips (validated on submit-rating edge). */

export const RATING_TAGS_RIDER_TO_DRIVER = [
  "Great driver",
  "Safe driver",
  "Clean car",
  "On time",
  "Friendly",
  "Quiet ride",
] as const;

export const RATING_TAGS_DRIVER_TO_RIDER = [
  "Great passenger",
  "On time",
  "Respectful",
  "Clean",
  "Easy to find",
] as const;

export type RiderToDriverTag = (typeof RATING_TAGS_RIDER_TO_DRIVER)[number];
export type DriverToRiderTag = (typeof RATING_TAGS_DRIVER_TO_RIDER)[number];
