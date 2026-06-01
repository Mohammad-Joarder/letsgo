import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { RATING_TAGS_DRIVER_TO_RIDER, RATING_TAGS_RIDER_TO_DRIVER } from "@/lib/ratingTags";
import { StarRatingPicker } from "@/components/shared/StarRatingPicker";
import { Button } from "@/components/ui/Button";
import { AppBottomSheetModal } from "@/components/ui/AppBottomSheetModal";
import { useModalChrome } from "@/hooks/useModalChrome";

export type RatingModalMode = "rider_rates_driver" | "driver_rates_rider";

type Props = {
  visible: boolean;
  onClose: () => void;
  mode: RatingModalMode;
  title?: string;
  onSubmit: (payload: {
    rating: number;
    comment: string;
    tags: string[];
  }) => Promise<void>;
  headerSlot?: ReactNode;
};

const TAGS: Record<RatingModalMode, readonly string[]> = {
  rider_rates_driver: RATING_TAGS_RIDER_TO_DRIVER,
  driver_rates_rider: RATING_TAGS_DRIVER_TO_RIDER,
};

export function RatingModal({ visible, onClose, mode, title, onSubmit, headerSlot }: Props) {
  const chrome = useModalChrome();
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = TAGS[mode];
  const defaultTitle =
    mode === "rider_rates_driver" ? "Rate your driver" : "Rate your passenger";

  async function handleSubmit() {
    setError(null);
    if (stars < 1) {
      setError("Choose 1–5 stars.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        rating: stars,
        comment: comment.trim(),
        tags: selectedTags,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} sheetStyle={{ maxHeight: "88%" }}>
      <View className="px-5 pb-8">
        <Text className="font-sora text-xl font-bold text-text">{title ?? defaultTitle}</Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">
          {mode === "rider_rates_driver"
            ? "Your feedback helps keep Lets Go safe and high quality."
            : "Ratings help other drivers know what to expect."}
        </Text>

        <ScrollView
          className="mt-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {headerSlot}
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Stars</Text>
          <View className="mt-2">
            <StarRatingPicker value={stars} onChange={setStars} size={40} />
          </View>

          <Text className="font-inter mt-6 text-xs font-semibold uppercase text-textSecondary">Tags</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {tags.map((t) => {
              const on = selectedTags.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() =>
                    setSelectedTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  className={`rounded-full border px-3 py-1.5 ${on ? "border-primary bg-primary/15" : "border-border bg-surface2"}`}
                >
                  <Text className="font-inter text-xs text-text">{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comment (optional)"
            placeholderTextColor={chrome.placeholderColor}
            multiline
            className="font-inter mt-4 min-h-[72px] rounded-xl border border-border bg-surface2 p-3 text-sm text-text"
          />

          {error ? <Text className="font-inter mt-3 text-sm text-error">{error}</Text> : null}

          <View className="mt-6 gap-3">
            <Button title="Submit rating" loading={submitting} onPress={() => void handleSubmit()} />
            <Button title="Close" variant="ghost" disabled={submitting} onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </AppBottomSheetModal>
  );
}

/** Inline rating block (same fields as modal body) for screens that embed instead of overlay. */
export function RatingFormBlock({
  mode,
  stars,
  onStarsChange,
  selectedTags,
  onToggleTag,
  comment,
  onCommentChange,
  showRatingLabel = true,
}: {
  mode: RatingModalMode;
  stars: number;
  onStarsChange: (n: number) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  comment: string;
  onCommentChange: (t: string) => void;
  showRatingLabel?: boolean;
}) {
  const chrome = useModalChrome();
  const tags = TAGS[mode];
  return (
    <View>
      {showRatingLabel ? (
        <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">Rating</Text>
      ) : null}
      <View className={showRatingLabel ? "mt-2" : ""}>
        <StarRatingPicker value={stars} onChange={onStarsChange} size={44} />
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {tags.map((t) => {
          const on = selectedTags.includes(t);
          return (
            <Pressable
              key={t}
              onPress={() => onToggleTag(t)}
              className={`rounded-full border px-3 py-1.5 ${on ? "border-primary bg-primary/15" : "border-border bg-surface2"}`}
            >
              <Text className="font-inter text-xs text-text">{t}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={comment}
        onChangeText={onCommentChange}
        placeholder="Comment (optional)"
        placeholderTextColor={chrome.placeholderColor}
        multiline
        className="font-inter mt-4 min-h-[80px] rounded-xl border border-border bg-surface2 p-3 text-sm text-text"
      />
    </View>
  );
}
