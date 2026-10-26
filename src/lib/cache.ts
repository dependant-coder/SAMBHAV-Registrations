/**
 * src/lib/cache.ts
 * Tiny localStorage cache so screens can show the last data when offline.
 * Every access is wrapped in try/catch: storage can be blocked, full, or empty.
 *
 * Keys look like  sx:v1:<memberId>:<name>   and are all cleared on sign-out.
 * Never cache phone numbers or anything a lead can see about other members.
 */
const PREFIX = 'sx:v1:';

export function cacheKey(memberId: string, name: string) {
  return `${PREFIX}${memberId}:${name}`;
}

export function cacheGet<T>(key: string, maxAgeMs = 7 * 24 * 3600 * 1000): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch { /* storage full or blocked: ignore */ }
}

export function cacheClearAll() {
  try {
    const dead: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) dead.push(k);
    }
    dead.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Remember a dismissal (e.g. the install banner) for N days. */
export function dismissedUntil(key: string): boolean {
  try {
    const t = Number(localStorage.getItem(`${PREFIX}dismiss:${key}`) || 0);
    return t > Date.now();
  } catch {
    return false;
  }
}

export function dismissFor(key: string, days = 7) {
  try {
    localStorage.setItem(`${PREFIX}dismiss:${key}`, String(Date.now() + days * 86400_000));
  } catch { /* ignore */ }
}
