import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from "react-native";

export type KeyboardAwareViewProps = ScrollViewProps & {
  className?: string;
  contentClassName?: string;
};

export function KeyboardAwareView({
  children,
  className = "",
  contentClassName = "",
  keyboardShouldPersistTaps = "handled",
  ...rest
}: KeyboardAwareViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className={`flex-1 ${className}`}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={{ flexGrow: 1 }}
        className={`flex-1 ${contentClassName}`}
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
