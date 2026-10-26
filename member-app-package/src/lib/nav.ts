/**
 * src/lib/nav.ts
 * Open-redirect protection for the "go back to where you were" logic.
 */
const KEY = 'sx:from';

/** Only same-site paths under /app (or /verify) are allowed. Anything else becomes the fallback. */
export function safeAppPath(raw: unknown, fallback = '/app'): string {
  const s = typeof raw === 'string' ? raw : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return fallback;
  if (!(s === '/app' || s.startsWith('/app/') || s.startsWith('/app?'))) return fallback;
  if (s.startsWith('/app/login')) return fallback;
  return s;
}

/** react-router location.state.from can be a string or a Location object */
export function fromState(state: unknown): string {
  const f = (state as { from?: unknown } | null)?.from;
  if (typeof f === 'string') return safeAppPath(f);
  if (f && typeof f === 'object') {
    const l = f as { pathname?: string; search?: string };
    return safeAppPath(`${l.pathname ?? ''}${l.search ?? ''}`);
  }
  return '/app';
}

/** Google sign-in leaves the site, so router state is lost: keep the destination in sessionStorage. */
export function rememberFrom(path: string) {
  try { sessionStorage.setItem(KEY, path); } catch { /* ignore */ }
}
export function takeFrom(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeAppPath(v);
  } catch {
    return '/app';
  }
}
