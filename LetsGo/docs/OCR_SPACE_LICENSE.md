# Licence OCR (OCR.space) — archived

**Status:** The mobile app and `submit-driver-onboarding` **no longer call** licence OCR or OCR.space. Licence capture is **upload + manual fields**; identity matching is **admin manual review** in the **compliance approval modal** on `/(auth)/admin-compliance` (all doc slots + checklist).

This file is kept for historical troubleshooting if you reintroduce an OCR Edge function later.

---

## Previous integration notes (deprecated)

The former Edge function was named **`extract-license-ocr`**. Secret: **`OCR_SPACE_API_KEY`** (Supabase → Edge Functions → Secrets).

### Common failures (when OCR was enabled)

1. **Image too large (free tier ~1 MB per file)**  
   Phone camera JPEGs are often **3–15 MB**. OCR.space’s free plan rejects oversized uploads.  
   **Mitigation:** resize and re-encode to a JPEG under ~900 KB before calling OCR.space.

2. **Invalid base64 (when using `base64Image`)**  
   OCR.space expects a **data URL** prefix (`data:image/jpeg;base64,...`) for base64 uploads; raw base64 can fail.  
   **Mitigation:** use **multipart `file` upload** instead.

3. **HTTP 200 with JSON errors**  
   OCR.space often returns **200** with `IsErroredOnProcessing`, `OCRExitCode`, or per-page `ErrorMessage`.

4. **Quota / API key**  
   Free tier limits (requests/day, Engine 2/3 quotas).

### Parameters that were sent

- **`OCREngine=2`** — better on photos / noisy backgrounds (licence in hand).
- **`detectOrientation=true`**, **`scale=true`** — per OCR.space guidance for skewed or lower-res shots.

### Operations (historical)

- PRO keys may use different hostnames from OCR.space’s welcome email — integrations often target **`https://api.ocr.space/parse/image`**.
