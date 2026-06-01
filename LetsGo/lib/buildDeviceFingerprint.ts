import Constants from "expo-constants";
import * as Device from "expo-device";

/**
 * Lightweight device fingerprint payload (not FingerprintJS browser SDK — RN-friendly).
 * Server hashes with DEVICE_FINGERPRINT_SALT.
 */
export function buildDeviceFingerprintPayload(): { fingerprint: string; metadata: Record<string, unknown> } {
  const fingerprint = [
    Constants.sessionId ?? "",
    Constants.installationId ?? "",
    Device.brand ?? "",
    Device.modelName ?? "",
    Device.osName ?? "",
    Device.osVersion ?? "",
  ].join("|");

  return {
    fingerprint,
    metadata: {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
    },
  };
}
