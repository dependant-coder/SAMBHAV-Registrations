// ============================================================
// dates.ts — IST date/time formatting (Asia/Kolkata, 12-hour)
// ============================================================

const IST = 'Asia/Kolkata';

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateOnlyFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * Format a UTC date/string as IST date + time.
 * Output example: "14 Oct 2026, 6:30 PM"
 */
export function formatIST(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return dateTimeFormatter.format(d);
}

/**
 * Format as IST date only. "14 Oct 2026"
 */
export function formatISTDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return dateOnlyFormatter.format(d);
}

/**
 * Returns hours and minutes remaining until expiresAt (from now).
 */
export function hoursMinutesUntil(expiresAt: Date | string): { hours: number; minutes: number; expired: boolean } {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const diffMs = exp.getTime() - Date.now();
  if (diffMs <= 0) return { hours: 0, minutes: 0, expired: true };
  const totalMinutes = Math.floor(diffMs / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60, expired: false };
}

/**
 * Seconds remaining as a human-readable countdown string: "23h 10m"
 */
export function formatCountdown(expiresAt: Date | string): string {
  const { hours, minutes, expired } = hoursMinutesUntil(expiresAt);
  if (expired) return 'expired';
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * Days remaining until a deadline (rounded down).
 */
export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
