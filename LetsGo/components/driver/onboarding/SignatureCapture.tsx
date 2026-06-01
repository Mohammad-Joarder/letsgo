/**
 * Drawn signature pad using react-native-gesture-handler + react-native-svg.
 * No additional packages. Exports the signature as a PNG data-URI via a
 * ref callback so the parent can upload it.
 *
 * Usage:
 *   const sigRef = useRef<SignatureCaptureRef>(null);
 *   // to export: const uri = await sigRef.current?.toDataUri();
 */

import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { forwardRef } from "react";
import { Pressable, Text, View } from "react-native";

export type SignatureCaptureRef = {
  /** Returns a data-URI string (image/svg+xml encoded as base64). */
  toDataUri: () => string | null;
  isEmpty: () => boolean;
  clear: () => void;
};

type Props = {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Called when the user lifts their finger after drawing. */
  onChange?: (isEmpty: boolean) => void;
};

type Point = { x: number; y: number };
type StrokePath = Point[];

export const SignatureCapture = forwardRef<SignatureCaptureRef, Props>(
  function SignatureCapture(
    {
      width = 320,
      height = 160,
      strokeColor = "#FFFFFF",
      strokeWidth = 2.5,
      onChange,
    },
    ref
  ) {
    const [paths, setPaths] = useState<StrokePath[]>([]);
    const currentPath = useRef<StrokePath>([]);

    function pointsToD(pts: StrokePath): string {
      if (pts.length === 0) return "";
      const [first, ...rest] = pts;
      const segments = rest.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      return `M${first.x.toFixed(1)} ${first.y.toFixed(1)} ${segments}`;
    }

    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => {
        currentPath.current = [{ x: e.x, y: e.y }];
      })
      .onUpdate((e) => {
        currentPath.current = [...currentPath.current, { x: e.x, y: e.y }];
        setPaths((prev) => {
          const next = [...prev];
          next[next.length > 0 && prev.length === next.length ? next.length - 1 : next.length] =
            currentPath.current;
          return next;
        });
      })
      .onEnd(() => {
        const finished = [...currentPath.current];
        currentPath.current = [];
        setPaths((prev) => {
          const all = [...prev];
          all[all.length - 1] = finished;
          return all;
        });
        onChange?.(false);
      })
      .onBegin((e) => {
        // start a fresh stroke slot
        setPaths((prev) => [...prev, [{ x: e.x, y: e.y }]]);
        currentPath.current = [{ x: e.x, y: e.y }];
      });

    const clear = useCallback(() => {
      setPaths([]);
      currentPath.current = [];
      onChange?.(true);
    }, [onChange]);

    const toDataUri = useCallback((): string | null => {
      if (paths.length === 0) return null;
      const pathEls = paths
        .map((pts) => {
          const d = pointsToD(pts);
          if (!d) return "";
          return `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join("\n");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#1A1F3A">\n${pathEls}\n</svg>`;
      const b64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${b64}`;
    }, [paths, strokeColor, strokeWidth, width, height]);

    useImperativeHandle(ref, () => ({
      toDataUri,
      isEmpty: () => paths.length === 0,
      clear,
    }));

    return (
      <View className="overflow-hidden rounded-2xl border border-border bg-surface2">
        <GestureHandlerRootView style={{ width, height }}>
          <GestureDetector gesture={pan}>
            <View style={{ width, height }}>
              <Svg width={width} height={height}>
                {paths.map((pts, i) => {
                  const d = pointsToD(pts);
                  if (!d) return null;
                  return (
                    <Path
                      key={i}
                      d={d}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </Svg>
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
        <View className="flex-row items-center justify-between border-t border-border px-4 py-2">
          <Text className="font-inter text-xs text-textSecondary">Draw your signature above</Text>
          <Pressable onPress={clear} hitSlop={10} className="py-1">
            <Text className="font-inter text-xs text-primary">Clear</Text>
          </Pressable>
        </View>
      </View>
    );
  }
);
