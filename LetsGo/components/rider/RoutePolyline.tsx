import { Polyline } from "react-native-maps";

type Coord = { latitude: number; longitude: number };

export function RoutePolyline({
  coordinates,
  strokeColor = "#00D4AA",
  strokeWidth = 4,
}: {
  coordinates: Coord[];
  strokeColor?: string;
  strokeWidth?: number;
}) {
  if (coordinates.length < 2) return null;
  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
    />
  );
}
