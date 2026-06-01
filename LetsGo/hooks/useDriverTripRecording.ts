import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useRef } from "react";

const RECORD_KEY = "letsgo_record_my_ride_v1";

export async function getRecordMyRideEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(RECORD_KEY);
  return v === "true";
}

export async function setRecordMyRideEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(RECORD_KEY, on ? "true" : "false");
}

/**
 * Trip recording toggle is stored on-device. Actual microphone recording was tied to expo-av
 * (removed so Expo starts without that native dependency). start/stop are no-ops until a
 * recording implementation is re-added with `npx expo install expo-av` if you need it.
 */
export function useDriverTripRecording() {
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    const enabled = await getRecordMyRideEnabled();
    if (!enabled) return;
    startedRef.current = true;
  }, []);

  const stop = useCallback(async (): Promise<boolean> => {
    startedRef.current = false;
    return false;
  }, []);

  return { start, stop };
}
