import Svg, { Circle, Path } from "react-native-svg";
import type { RideType } from "@/lib/bookingTypes";

type Props = {
  type: RideType;
  size?: number;
  color: string;
};

const VB = "0 0 80 40";

function Wheels({ color }: { color: string }) {
  return (
    <>
      <Circle cx={22} cy={30} r={5.25} fill={color} />
      <Circle cx={58} cy={30} r={5.25} fill={color} />
    </>
  );
}

/**
 * Professional side-profile vehicle icons per ride tier (filled silhouette + cabin glass).
 */
export function RideTypeIcon({ type, size = 32, color }: Props) {
  const height = Math.round(size * 0.5);

  switch (type) {
    case "economy":
      return (
        <Svg width={size} height={height} viewBox={VB} accessibilityRole="image">
          <Wheels color={color} />
          <Path
            fill={color}
            d="M9 28.5h62v2H9v-2zm2.2-2.2c0-4.8 4.3-8.8 9.8-9.6l7.5-1.2h17.5c3.8 0 7 1.6 9 4.2l3.8 5.2h8.2c2.1 0 3.8 1.7 3.8 3.8v1.6H11.2v-4z"
          />
          <Path
            fill={color}
            d="M47.5 15.8 57 20.5l2.5 8h-9.5l-4.5-8.2 1-4.5z"
          />
          <Path fill={color} opacity={0.28} d="M23.5 17.2h27l-2.2 4.3H25.7l-2.2-4.3z" />
        </Svg>
      );
    case "comfort":
      return (
        <Svg width={size} height={height} viewBox={VB} accessibilityRole="image">
          <Circle cx={20} cy={30} r={5.25} fill={color} />
          <Circle cx={60} cy={30} r={5.25} fill={color} />
          <Path
            fill={color}
            d="M7 28.5h66v2H7v-2zm2.5-2.2c0-4.5 3.8-8.5 9-9.4l9.5-1.4h21c3.4 0 6.4 1.1 8.4 3.2l4.8 5.8h9.8c2.2 0 4 1.8 4 4v1.8H9.5v-4.4z"
          />
          <Path fill={color} d="M61.5 19.5h7l3.5 9h-7.8l-2.7-9z" />
          <Path fill={color} opacity={0.28} d="M24 17h31l-2.4 4.5H26.4L24 17z" />
        </Svg>
      );
    case "premium":
      return (
        <Svg width={size} height={height} viewBox={VB} accessibilityRole="image">
          <Circle cx={21} cy={30} r={5} fill={color} />
          <Circle cx={59} cy={30} r={5} fill={color} />
          <Path
            fill={color}
            d="M5 28.8h70v2.2H5V28.8zm3.8-2c0-3.8 3.2-7.2 7.5-8.2l11.5-2h19.5c3.8 0 6.8 1.8 8.8 4.6l3.2 5.2h10.5c2.4 0 4.3 2 4.3 4.3v1.3H8.8v-5.2z"
          />
          <Path
            fill={color}
            d="M12.5 20.2c1.8-1.2 4.5-1.8 7.2-1.8h25.6c2.8 0 5.2.7 6.8 2.2l1.8 2.2H14.8l-2.3-2.6z"
          />
          <Path fill={color} opacity={0.28} d="M26.5 17.2h27.5l-1.6 3.6H28.1l-1.6-3.6z" />
          <Path fill={color} d="M57.5 19.8 66 23l2 5.8h-5.5l-2-9z" />
        </Svg>
      );
    case "xl":
      return (
        <Svg width={size} height={height} viewBox={VB} accessibilityRole="image">
          <Circle cx={18} cy={30.5} r={5.25} fill={color} />
          <Circle cx={62} cy={30.5} r={5.25} fill={color} />
          <Path
            fill={color}
            d="M5 30h70v2H5v-2zm3-2V13.5C8 11.2 9.8 9.5 12 9.5h56c2.2 0 4 1.7 4 4V28H8zm3.5-15h49v12H11.5V13z"
          />
          <Path fill={color} opacity={0.28} d="M15 12.5h50v9.5H15v-9.5z" />
          <Path
            fill={color}
            opacity={0.18}
            d="M17 12.5h7.5v9.5H17v-9.5zm12.5 0H37v9.5H29.5v-9.5zm12.5 0h7.5v9.5H42v-9.5z"
          />
        </Svg>
      );
    default:
      return null;
  }
}
