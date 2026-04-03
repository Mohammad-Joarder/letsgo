import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useMemo } from "react";
import { Text } from "react-native";

export type BottomSheetProps = Omit<BottomSheetModalProps, "children"> & {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.55}
      pressBehavior="close"
    />
  );
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  function BottomSheet(
    { title, children, snapPoints = ["40%", "75%"], onChange, ...rest },
    ref
  ) {
    const points = useMemo(() => snapPoints, [snapPoints]);

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={points}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "#131929" }}
        handleIndicatorStyle={{ backgroundColor: "#1E2D45" }}
        backdropComponent={renderBackdrop}
        onChange={onChange}
        {...rest}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
          {title ? (
            <Text className="font-sora mb-4 text-lg font-semibold text-text">{title}</Text>
          ) : null}
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
