import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { uploadDriverDocument } from "@/lib/driverDocumentUpload";
import { supabase } from "@/lib/supabase";
import type { DriverDocumentType } from "@/lib/types";

type Props = {
  driverId: string;
  documentType: DriverDocumentType;
  label: string;
  description?: string;
  onUploaded?: () => void;
};

export function DocumentCaptureTile({ driverId, documentType, label, description, onUploaded }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("driver_documents")
        .select("id")
        .eq("driver_id", driverId)
        .eq("document_type", documentType)
        .maybeSingle();
      if (!cancelled && data) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, documentType]);

  async function pickAndUpload(source: "camera" | "library") {
    setError(null);
    setBusy(true);
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Permission denied — enable camera or photos in Settings.");
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      setLocalUri(asset.uri);
      await uploadDriverDocument({
        driverId,
        documentType,
        localUri: asset.uri,
        mimeType: asset.mimeType,
      });
      setDone(true);
      onUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <Text className="font-sora text-base font-semibold text-text">{label}</Text>
      {description ? (
        <Text className="font-inter mt-1 text-xs leading-5 text-textSecondary">{description}</Text>
      ) : null}

      {localUri ? (
        <Image source={{ uri: localUri }} className="mt-4 h-40 w-full rounded-xl bg-surface2" resizeMode="cover" />
      ) : null}

      {error ? <Text className="font-inter mt-3 text-xs text-error">{error}</Text> : null}

      <View className="mt-4 flex-row gap-3">
        <Pressable
          onPress={() => void pickAndUpload("library")}
          disabled={busy}
          className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-surface2 py-3 active:opacity-80"
        >
          {busy ? (
            <ActivityIndicator color="#00D4AA" />
          ) : (
            <>
              <Ionicons name="images-outline" size={18} color="#FFFFFF" />
              <Text className="font-inter ml-2 text-sm text-text">Gallery</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => void pickAndUpload("camera")}
          disabled={busy}
          className="flex-1 flex-row items-center justify-center rounded-xl border border-primary bg-primary/15 py-3 active:opacity-80"
        >
          <Ionicons name="camera-outline" size={18} color="#00D4AA" />
          <Text className="font-inter ml-2 text-sm text-text">Camera</Text>
        </Pressable>
      </View>

      {done ? (
        <Text className="font-inter mt-3 text-xs text-success">
          Uploaded — this requirement is satisfied. Your file is stored securely pending admin review.
        </Text>
      ) : null}
    </Card>
  );
}
