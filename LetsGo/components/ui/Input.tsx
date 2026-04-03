import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, className = "", containerClassName = "", ...rest },
  ref
) {
  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label ? (
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#8A94A6"
        className={`font-inter min-h-[52px] rounded-2xl border border-border bg-surface2 px-4 text-base text-text ${error ? "border-error" : ""} ${className}`}
        {...rest}
      />
      {error ? <Text className="font-inter mt-1 text-sm text-error">{error}</Text> : null}
    </View>
  );
});
