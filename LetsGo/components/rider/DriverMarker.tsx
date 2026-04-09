import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { View } from "react-native";
import { Marker } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = {
  driverId: string;
  latitude: number;
  longitude: number;
  /** Degrees clockwise from north; rotates the car icon. */
  headingDeg?: number;
  /** Pulsing ring (e.g. available drivers on home). */
  pulse?: boolean;
};

export function DriverMarker({
  driverId,
  latitude,
  longitude,
  headingDeg = 0,
  pulse = true,
}: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
  }, [pulse, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pulse ? 0.35 : 0,
  }));

  return (
    <Marker
      identifier={driverId}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      flat
      rotation={headingDeg}
    >
      <View className="h-14 w-14 items-center justify-center">
        {pulse ? (
          <Animated.View
            style={ringStyle}
            className="absolute h-12 w-12 rounded-full bg-primary"
          />
        ) : null}
        <View className="rounded-full border border-primary/80 bg-surface2 p-1.5">
          <Ionicons name="car" size={18} color="#00D4AA" />
        </View>
      </View>
    </Marker>
  );
}
