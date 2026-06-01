import { View } from "react-native";

type Props = {
  total: number;
  current: number;
  /** Optional: steps the user has already completed (turns dot accent colour). */
  completed?: number[];
};

/**
 * Simple dot-row step indicator.
 * Active dot: primary colour, larger.
 * Completed dot: primary/60 tint.
 * Future dot: surface2.
 */
export function ProgressDots({ total, current, completed = [] }: Props) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = completed.includes(step) && step !== current;
        return (
          <View
            key={step}
            className={[
              "rounded-full",
              isActive ? "h-3 w-3 bg-primary" : isDone ? "h-2 w-2 bg-primary/60" : "h-2 w-2 bg-surface2",
            ].join(" ")}
          />
        );
      })}
    </View>
  );
}
