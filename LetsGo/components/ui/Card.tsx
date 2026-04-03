import { View, type ViewProps } from "react-native";

export type CardProps = ViewProps & {
  className?: string;
};

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}
