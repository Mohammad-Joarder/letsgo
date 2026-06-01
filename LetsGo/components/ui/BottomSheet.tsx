import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo } from "react";
import { Text } from "react-native";
import { useModalChrome } from "@/hooks/useModalChrome";

export type BottomSheetProps = Omit<BottomSheetModalProps, "children"> & {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
};

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  function BottomSheet(
    { title, children, snapPoints = ["40%", "75%"], onChange, ...rest },
    ref
  ) {
    const chrome = useModalChrome();
    const points = useMemo(() => snapPoints, [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={chrome.bottomSheet.backdropOpacity}
          pressBehavior="close"
        />
      ),
      [chrome.bottomSheet.backdropOpacity]
    );

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={points}
        enablePanDownToClose
        backgroundStyle={chrome.bottomSheet.backgroundStyle}
        handleIndicatorStyle={chrome.bottomSheet.handleIndicatorStyle}
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
