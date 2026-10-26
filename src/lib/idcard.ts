/**
 * src/lib/idcard.ts
 * Everything about the QR / verify link in one place.
 */
const HEX18 = /^[0-9a-f]{18}$/;

export const isPublicId = (s: string) => HEX18.test(s);

/** 'SMB4-' + 4-digit zero-padded membership number */
export const formatMemberNo = (n: number | string | null | undefined) =>
  n == null || n === '' ? '' : `SMB4-${String(n).padStart(4, '0')}`;

/** Base URL for QR links. VITE_SITE_URL wins so a QR made on a Vercel preview still points at the real site. */
export function siteUrl() {
  const env = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (env) return env;
  if (import.meta.env.DEV) console.warn('[idcard] VITE_SITE_URL is not set, falling back to window.location.origin');
  return window.location.origin;
}

export const verifyUrl = (publicId: string) => `${siteUrl()}/verify/${publicId}`;

/**
 * Turn whatever the camera read into a public id, or null.
 * Accepts a /verify/<18 hex> URL (any host: we never open it) or a bare 18-hex string.
 * Anything else is not a Sambhav ID.
 */
export function parseScanned(text: string): string | null {
  const t = (text ?? '').trim();
  if (HEX18.test(t)) return t;
  try {
    const u = new URL(t);
    const m = u.pathname.match(/\/verify\/([0-9a-f]{18})\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Manual entry: "42", "SMB4-0042", "smb4 42" -> "42". Returns null if there are no digits. */
export function parseMemberNo(input: string): string | null {
  const digits = (input ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits && digits.length <= 9 ? digits : null;
}
