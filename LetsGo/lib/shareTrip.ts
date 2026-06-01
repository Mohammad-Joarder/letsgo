import * as Clipboard from "expo-clipboard";
import { Alert, Platform, Share } from "react-native";

export const TRIP_TRACK_BASE = "https://letsgo.app/track/";

export type TripShareDetails = {
  pickup?: string;
  dropoff?: string;
  driverName?: string;
};

export function buildTripShareMessage(tripId: string, details?: TripShareDetails): string {
  const url = `${TRIP_TRACK_BASE}${tripId}`;
  const lines = ["Follow my Let's Go trip:", url];
  if (details?.driverName) lines.push(`Driver: ${details.driverName}`);
  if (details?.pickup) lines.push(`Pickup: ${details.pickup}`);
  if (details?.dropoff) lines.push(`Drop-off: ${details.dropoff}`);
  return lines.join("\n");
}

/** Opens the native share sheet with trip link and copies the message to the clipboard. */
export async function shareActiveTrip(tripId: string, details?: TripShareDetails): Promise<void> {
  const message = buildTripShareMessage(tripId, details);
  const url = `${TRIP_TRACK_BASE}${tripId}`;

  try {
    await Clipboard.setStringAsync(message);
    await Share.share(
      Platform.select({
        ios: { message, url },
        default: { message, title: "Share my Let's Go trip" },
      }) ?? { message }
    );
  } catch {
    try {
      await Clipboard.setStringAsync(message);
      Alert.alert(
        "Link copied",
        "We could not open the share menu on this device. The trip details were copied to your clipboard — paste them into a message to share."
      );
    } catch {
      Alert.alert("Share trip", "Could not share or copy the trip link. Please try again.");
    }
  }
}
