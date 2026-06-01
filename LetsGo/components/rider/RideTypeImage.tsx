import { Image, StyleSheet, View } from "react-native";
import type { RideType } from "@/lib/bookingTypes";
import { RIDE_TYPE_IMAGES } from "@/lib/rideTypeAssets";

type Props = {
  type: RideType;
  size?: number;
};

export function RideTypeImage({ type, size = 52 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.27 }]}>
      <Image
        source={RIDE_TYPE_IMAGES[type]}
        style={styles.image}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel={`${type} vehicle`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#1a2332",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
