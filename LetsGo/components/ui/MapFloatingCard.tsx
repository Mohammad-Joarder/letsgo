import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { useModalChrome } from "@/hooks/useModalChrome";

type Props = ViewProps & {
  children: ReactNode;
};

/** Opaque elevated card for controls on top of maps (both themes). */
export function MapFloatingCard({ children, style, className = "", ...rest }: Props) {
  const chrome = useModalChrome();
  return (
    <View style={[chrome.mapPanel, style]} className={className} {...rest}>
      {children}
    </View>
  );
}
