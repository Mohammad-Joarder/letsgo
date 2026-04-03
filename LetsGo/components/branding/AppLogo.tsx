import { Image, type ImageStyle, type StyleProp } from "react-native";
import { BRAND } from "@/lib/brandAssets";

export type AppLogoProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

/** Full brand lockup (LG mark + “Let’s Go” + tagline in artwork). */
export function AppLogo({ width = 160, height = 56, style }: AppLogoProps) {
  return (
    <Image
      accessibilityLabel="Let's Go logo"
      accessibilityRole="image"
      source={BRAND.logoFull}
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
