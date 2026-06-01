import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalChrome } from "@/hooks/useModalChrome";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";

export type TripChatModalProps = {
  visible: boolean;
  onClose: () => void;
  tripId: string | undefined;
  selfUserId: string | undefined;
  peerPhone?: string | null;
  peerLabel?: string;
};

type MsgRow = {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
};

const QUICK = [
  "On my way",
  "Almost there",
  "I'll be there in 2 min",
  "Where are you?",
  "I'm outside",
  "Running late",
];

export function TripChatModal({
  visible,
  onClose,
  tripId,
  selfUserId,
  peerPhone,
  peerLabel = "Trip chat",
}: TripChatModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = useModalChrome();
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MsgRow>>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from("trip_messages")
      .select("id, sender_id, body, sent_at")
      .eq("trip_id", tripId)
      .order("sent_at", { ascending: true })
      .limit(200);
    if (error) {
      console.warn("[TripChat]", error.message);
      return;
    }
    setMessages((data ?? []) as MsgRow[]);
  }, [tripId]);

  useEffect(() => {
    if (!visible || !tripId) return;
    void load();
    const ch = supabase
      .channel(`trip_messages:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const row = payload.new as MsgRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [visible, tripId, load]);

  useEffect(() => {
    if (visible && messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [visible, messages.length]);

  async function sendBody(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !tripId || !selfUserId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("trip_messages").insert({
        trip_id: tripId,
        sender_id: selfUserId,
        body: trimmed,
      });
      if (error) throw error;
      setDraft("");
      void load();
    } catch (e) {
      console.warn("[TripChat] send", e);
    } finally {
      setSending(false);
    }
  }

  const headerRight = useMemo(() => {
    if (!peerPhone) return null;
    const tel = `tel:${String(peerPhone).replace(/\s/g, "")}`;
    return (
      <Pressable onPress={() => void Linking.openURL(tel)} className="rounded-full bg-primary/15 px-3 py-1.5">
        <Text className="font-inter text-xs font-semibold text-primary">Call</Text>
      </Pressable>
    );
  }, [peerPhone]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View
          className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable onPress={onClose} hitSlop={12} className="flex-row items-center gap-1">
            <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
            <Text className="font-inter text-sm text-textSecondary">Close</Text>
          </Pressable>
          <Text className="font-sora flex-1 text-center text-base font-semibold text-text" numberOfLines={1}>
            {peerLabel}
          </Text>
          {headerRight ?? <View className="w-16" />}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_id === selfUserId;
            return (
              <View className={`mb-3 max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
                <View
                  className={`rounded-2xl px-3 py-2 ${
                    mine ? "rounded-br-sm bg-primary/25" : "rounded-bl-sm bg-surface2"
                  }`}
                >
                  <Text className="font-inter text-sm leading-5 text-text">{item.body}</Text>
                </View>
                <Text className={`font-inter mt-1 text-[10px] text-textSecondary ${mine ? "text-right" : ""}`}>
                  {new Date(item.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          }}
        />

        <View className="border-t border-border px-3 pb-2 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
          <FlatList
            horizontal
            data={QUICK}
            keyExtractor={(q) => q}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            renderItem={({ item: q }) => (
              <Pressable
                onPress={() => void sendBody(q)}
                className="rounded-full border border-border bg-surface2 px-3 py-1.5 active:opacity-80"
              >
                <Text className="font-inter text-xs text-textSecondary">{q}</Text>
              </Pressable>
            )}
          />
          <View className="flex-row items-end gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={chrome.placeholderColor}
              multiline
              className="font-inter max-h-24 min-h-[44px] flex-1 rounded-2xl border border-border bg-surface2 px-4 py-3 text-sm text-text"
            />
            <Pressable
              onPress={() => void sendBody(draft)}
              disabled={sending || !draft.trim()}
              className="mb-1 h-11 w-11 items-center justify-center rounded-full bg-primary disabled:opacity-40"
            >
              <Ionicons name="send" size={18} color={chrome.iconOnPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
