function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Normalise common Australian mobile inputs to E.164 (+61…). */
export function normalizeAuPhoneE164(raw: string): string | null {
  const t = raw.trim();
  const d = digits(t);
  if (d.length === 10 && d.startsWith("0")) return `+61${d.slice(1)}`;
  if (d.length === 9) return `+61${d}`;
  if (t.startsWith("+61")) {
    const rest = digits(t.slice(3));
    if (rest.length >= 9) return `+61${rest}`;
  }
  if (d.length === 12 && d.startsWith("61")) return `+${d}`;
  return null;
}
