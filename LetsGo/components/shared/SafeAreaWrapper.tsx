import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export type SafeAreaWrapperProps = ViewProps & {
  edges?: Edge[];
  className?: string;
};

export function SafeAreaWrapper({
  children,
  edges = ["top", "left", "right"],
  className = "",
  ...rest
}: SafeAreaWrapperProps) {
  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-background ${className}`} {...rest}>
      {children}
    </SafeAreaView>
  );
}
