import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import type { DriverDocumentType } from "@/lib/types";

const BUCKET = "driver-documents";

function randomFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function extFromMime(mime: string | undefined): string {
  if (!mime) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "jpg";
}

/**
 * Normalise camera-roll images (incl. HEIC on iOS) to JPEG for reliable decode on Edge (OCR / face compare).
 */
async function readUploadBody(
  localUri: string,
  mimeType?: string | null
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const useNativeJpeg =
    Platform.OS === "ios" || Platform.OS === "android";

  if (useNativeJpeg) {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 2400 } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
      );
      const res = await fetch(manipulated.uri);
      if (!res.ok) throw new Error("Could not read normalized image.");
      const buf = await res.arrayBuffer();
      return { body: buf, contentType: "image/jpeg" };
    } catch (e) {
      console.warn("[uploadDriverDocument] JPEG normalize failed, using original bytes", e);
    }
  }

  const res = await fetch(localUri);
  if (!res.ok) {
    throw new Error("Could not read the selected image.");
  }
  const buf = await res.arrayBuffer();
  const contentType =
    mimeType && mimeType.length > 0 ? mimeType : res.headers.get("content-type") ?? "image/jpeg";
  return { body: buf, contentType };
}

/**
 * Uploads a driver document image to private storage and upserts `driver_documents`.
 * Object path: `{driverId}/{documentType}/{uuid}.{ext}` (matches storage RLS).
 */
export async function uploadDriverDocument(params: {
  driverId: string;
  documentType: DriverDocumentType;
  localUri: string;
  mimeType?: string | null;
}): Promise<{ storagePath: string }> {
  const { driverId, documentType, localUri, mimeType } = params;
  const { data: existing } = await supabase
    .from("driver_documents")
    .select("id, storage_path")
    .eq("driver_id", driverId)
    .eq("document_type", documentType)
    .maybeSingle();

  const id = randomFileId();
  const { body, contentType } = await readUploadBody(localUri, mimeType);
  const ext = extFromMime(contentType);
  const storagePath = `${driverId}/${documentType}/${id}.${ext}`;

  const oldPath =
    existing && typeof (existing as { storage_path?: string }).storage_path === "string"
      ? (existing as { storage_path: string }).storage_path
      : null;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType, upsert: true });
  if (upErr) throw upErr;

  if (oldPath && oldPath !== storagePath) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
    if (rmErr) {
      console.warn("[uploadDriverDocument] old file remove failed", rmErr.message);
    }
  }

  const { error: rowErr } = await supabase.from("driver_documents").upsert(
    {
      driver_id: driverId,
      document_type: documentType,
      storage_path: storagePath,
      is_verified: false,
      rejection_reason: null,
      verified_at: null,
      verified_by: null,
    },
    { onConflict: "driver_id,document_type" }
  );
  if (rowErr) throw rowErr;

  return { storagePath };
}
