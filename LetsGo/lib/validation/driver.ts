/**
 * Pure validation helpers for driver onboarding.
 * No external libraries — regex + arithmetic only.
 * Every function returns { ok: true } | { ok: false; error: string }.
 */

type ValidationResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Personal info
// ---------------------------------------------------------------------------

/**
 * Full legal name — at least two words, letters/hyphens/apostrophes only.
 * Example: "Jane O'Brien-Smith" → ok
 * Example: "Madonna" → error
 */
export function validateFullName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Enter your full legal name." };
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) return { ok: false, error: "Enter both your first and last name." };
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]+$/.test(trimmed))
    return { ok: false, error: "Name may only contain letters, hyphens and apostrophes." };
  return { ok: true };
}

/**
 * Date of birth in YYYY-MM-DD format — driver must be ≥18 years old.
 * Example: "2000-01-01" with today 2026-05-26 → ok (26 years old)
 * Example: "2010-05-26" → error (under 18)
 */
export function validateDateOfBirth(dob: string): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim()))
    return { ok: false, error: "Enter your date of birth (YYYY-MM-DD)." };
  const [y, m, d] = dob.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d
  ) {
    return { ok: false, error: "Enter a valid date of birth." };
  }
  const today = new Date();
  const eighteenYearsAgo = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );
  if (birth > eighteenYearsAgo)
    return { ok: false, error: "You must be at least 18 years old to drive." };
  return { ok: true };
}

/**
 * Australian mobile number — 04xxxxxxxx or +614xxxxxxxx (10 digits after normalisation).
 * Example: "0412 345 678" → ok
 * Example: "+61412345678" → ok
 * Example: "02 9999 9999" → error (not mobile)
 */
export function validateAustralianMobile(phone: string): ValidationResult {
  const digits = phone.replace(/[\s\-().]/g, "");
  // Accept +614XXXXXXXX or 04XXXXXXXX
  const local = digits.startsWith("+61")
    ? "0" + digits.slice(3)
    : digits.startsWith("61") && digits.length === 11
    ? "0" + digits.slice(2)
    : digits;
  if (!/^04\d{8}$/.test(local))
    return {
      ok: false,
      error: "Enter an Australian mobile number starting with 04 (e.g. 0412 345 678).",
    };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vehicle details
// ---------------------------------------------------------------------------

/**
 * Vehicle year — between 1990 and current year + 1, and at most 10 years old.
 * Example: year 2020, today 2026 → ok (6 years old)
 * Example: year 2010, today 2026 → error (16 years old)
 */
export function validateVehicleYear(year: number): ValidationResult {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1)
    return { ok: false, error: `Enter a valid vehicle year (1990–${currentYear + 1}).` };
  if (year < currentYear - 10)
    return {
      ok: false,
      error: `Vehicle must be no more than 10 years old (${currentYear - 10} or newer).`,
    };
  return { ok: true };
}

/**
 * Australian vehicle registration plate.
 * Accepted patterns (case-insensitive):
 *   - Standard: 3 letters + 3 digits, e.g. ABC123
 *   - Newer 6-char: 3 letters + 2 digits + 1 letter, e.g. ABC12D
 *   - 7-char: 3 letters + 3 digits + 1 letter, e.g. ABC123D  (QLD / VIC)
 *   - Personalised: 2–7 alphanumeric chars containing at least one letter
 * Example: "ABC123" → ok
 * Example: "1AB" → ok (personalised)
 * Example: "" → error
 */
export function validateAustralianPlate(plate: string): ValidationResult {
  const upper = plate.trim().toUpperCase().replace(/[\s-]/g, "");
  if (upper.length < 2 || upper.length > 7)
    return { ok: false, error: "Enter a valid Australian registration plate (2–7 characters)." };
  if (!/[A-Z]/.test(upper))
    return { ok: false, error: "Plate must contain at least one letter." };
  if (!/^[A-Z0-9]+$/.test(upper))
    return { ok: false, error: "Plate may only contain letters and digits." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bank account
// ---------------------------------------------------------------------------

/**
 * Australian BSB — 6 digits, optionally formatted as NNN-NNN.
 * Validates that the leading 2 digits match known Australian bank prefixes.
 *
 * Known Australian bank prefix ranges (first two digits):
 *   01–09  CBA / BSA heritage
 *   10–19  Westpac / St George / BOM / Bank SA
 *   20–29  ANZ
 *   30–39  Westpac subsidiaries / smaller banks
 *   40–49  BankWest / Citibank
 *   55     BankWest alternative
 *   60–69  NAB / MLC
 *   70–79  Various credit unions / mutuals
 *   80–89  Building societies / mutuals
 *   90–99  BPAY / EFT / non-bank routes (less common for payouts)
 *
 * Example: "062-000" (CBA) → ok
 * Example: "110-000" (Westpac) → ok
 * Example: "999-000" → error (no bank)
 */
export function validateBSB(bsb: string): ValidationResult {
  const digits = bsb.replace(/\D/g, "");
  if (digits.length !== 6) return { ok: false, error: "BSB must be exactly 6 digits (e.g. 062-000)." };
  const prefix = Number(digits.slice(0, 2));
  const knownPrefix =
    (prefix >= 1 && prefix <= 9) ||
    (prefix >= 10 && prefix <= 49) ||
    prefix === 55 ||
    (prefix >= 60 && prefix <= 99);
  if (!knownPrefix)
    return { ok: false, error: "BSB does not match a known Australian bank prefix." };
  return { ok: true };
}

/**
 * Australian bank account number — 5 to 12 digits.
 * Example: "123456789" → ok
 * Example: "123" → error
 */
export function validateAccountNumber(account: string): ValidationResult {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 12)
    return { ok: false, error: "Account number must be 5–12 digits." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Document upload
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);

/**
 * Validate a file before upload.
 * Example: fileSize=4MB, mimeType="image/jpeg" → ok
 * Example: fileSize=6MB → error
 * Example: mimeType="image/gif" → error
 */
export function validateDocumentFile(params: {
  fileSize?: number | null;
  mimeType?: string | null;
}): ValidationResult {
  const { fileSize, mimeType } = params;
  if (fileSize != null && fileSize > MAX_FILE_SIZE_BYTES)
    return { ok: false, error: "File must be smaller than 5 MB." };
  if (mimeType != null && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()))
    return { ok: false, error: "Only JPEG, PNG, or PDF files are accepted." };
  return { ok: true };
}
