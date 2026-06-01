import type { ImageSourcePropType } from "react-native";
import type { RideType } from "@/lib/bookingTypes";

/**
 * Realistic vehicle photography per ride tier (Unsplash — free to use).
 * Replace files under assets/images/ride-types/ with your own art direction if needed.
 */
export const RIDE_TYPE_IMAGES: Record<RideType, ImageSourcePropType> = {
  economy: require("../assets/images/ride-types/economy.jpg"),
  comfort: require("../assets/images/ride-types/comfort.jpg"),
  premium: require("../assets/images/ride-types/premium.jpg"),
  xl: require("../assets/images/ride-types/xl.jpg"),
};
