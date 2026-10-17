// ============================================================
// normalize.ts — JS mirror of the SQL normalize_name / normalize_phone / normalize_roll
// MUST stay in sync with the SQL in schema.sql section 7.
// ============================================================

/**
 * Normalizes a person's name for roster matching.
 * Rule: Unicode NFC → strip zero-width chars → collapse whitespace → trim → lowercase.
 * Matches SQL: public.normalize_name(p text)
 */
export function normalizeName(raw: string): string {
  const nfc = raw.normalize('NFC');
  // Remove zero-width chars: U+200B..U+200D, U+FEFF
  const noZW = nfc.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // Collapse any run of whitespace (incl NBSP U+00A0) to a single space
  const collapsed = noZW.replace(/[\s\u00A0]+/g, ' ');
  return collapsed.trim().toLowerCase();
}

/**
 * Normalizes an Indian mobile number to 10 digits.
 * Strips +91 / 91 prefix / leading 0. Returns null if empty.
 * Matches SQL: public.normalize_phone(p text)
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Normalizes a roll number: uppercase, remove spaces.
 * Matches SQL: public.normalize_roll(p text)
 */
export function normalizeRoll(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

/**
 * Validates an Indian mobile number (10 digits, starts 6-9).
 */
export function isValidPhone(normalized: string | null): boolean {
  if (!normalized) return false;
  return /^[6-9][0-9]{9}$/.test(normalized);
}

/**
 * Validates an email address (permissive, matches DB check).
 */
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
