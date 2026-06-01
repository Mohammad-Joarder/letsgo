/** Minimum remaining validity for driver licence and insurance (months). */
export const MIN_DOCUMENT_VALIDITY_MONTHS = 6;

/** Minimum calendar months the driver must have held a licence (first issue date must be on or before today minus this many months). */
export const MIN_LICENSE_HELD_MONTHS = 6;

export function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local calendar date (no timezone shift). */
export function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return dt;
}

export function addMonthsLocal(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

/** Earliest acceptable expiry (today + months, local date). */
export function minExpiryDateFromToday(months = MIN_DOCUMENT_VALIDITY_MONTHS): Date {
  return addMonthsLocal(todayLocal(), months);
}

export function expiryMeetsMinimumValidity(
  expiryIso: string,
  months = MIN_DOCUMENT_VALIDITY_MONTHS
): { ok: true } | { ok: false; error: string } {
  const expiry = parseIsoDateLocal(expiryIso);
  if (!expiry) {
    return { ok: false, error: "Select a valid expiry date." };
  }
  const min = minExpiryDateFromToday(months);
  if (expiry < min) {
    return {
      ok: false,
      error: `Expiry must be at least ${months} months from today (${formatIsoDateLocal(min)} or later).`,
    };
  }
  return { ok: true };
}

export function isStoredExpiryValid(
  value: string | null | undefined,
  months = MIN_DOCUMENT_VALIDITY_MONTHS
): boolean {
  if (!value) return false;
  const iso = String(value).slice(0, 10);
  return expiryMeetsMinimumValidity(iso, months).ok;
}

/** Latest (most recent) first-issue date that still satisfies "held at least `months` months" — inclusive upper bound for the picker. */
export function maxLicenseFirstIssueDate(months = MIN_LICENSE_HELD_MONTHS): Date {
  return addMonthsLocal(todayLocal(), -months);
}

/** Earliest first-issue date allowed in the picker (avoid garbage dates). */
export function minLicenseFirstIssuePickerDate(): Date {
  return new Date(1940, 0, 1);
}

/**
 * Licence first issue must be on or before (today − months): driver has held the licence at least that long.
 * Issue date must not be in the future.
 */
export function licenseFirstIssueMeetsMinimumHeld(
  issueIso: string,
  months = MIN_LICENSE_HELD_MONTHS
): { ok: true } | { ok: false; error: string } {
  const issue = parseIsoDateLocal(issueIso);
  if (!issue) {
    return { ok: false, error: "Enter the first issue date from your licence (field 4a on an Australian licence)." };
  }
  const today = todayLocal();
  if (issue > today) {
    return { ok: false, error: "First issue date cannot be in the future." };
  }
  const cutoff = maxLicenseFirstIssueDate(months);
  if (issue > cutoff) {
    return {
      ok: false,
      error: `Your licence must have been first issued on or before ${formatIsoDateLocal(
        cutoff
      )} — at least ${months} months of driving history is required.`,
    };
  }
  return { ok: true };
}

export function isStoredLicenseFirstIssueValid(
  value: string | null | undefined,
  months = MIN_LICENSE_HELD_MONTHS
): boolean {
  if (!value) return false;
  return licenseFirstIssueMeetsMinimumHeld(String(value).slice(0, 10), months).ok;
}
