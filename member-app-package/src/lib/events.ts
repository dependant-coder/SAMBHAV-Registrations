/**
 * src/lib/events.ts
 * Row types + the time rules for events and announcements.
 * The browser only uses these to DISPLAY things; the database (check_in) is the real judge.
 */
export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  audience: 'all' | 'domain';
  domain_id: string | null;
  attendance_opens_at: string | null;
  attendance_closes_at: string | null;
  cancelled: boolean;
  reminder_minutes?: number;
  domain?: { name: string } | null;
};

export const EVENT_COLS =
  'id,title,description,venue,starts_at,ends_at,audience,domain_id,attendance_opens_at,attendance_closes_at,cancelled,reminder_minutes,domain:domains(name)';

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'domain';
  domain_id: string | null;
  pinned: boolean;
  link_url: string | null;
  published_at: string;
  expires_at: string | null;
  domain?: { name: string } | null;
};

export const ANN_COLS = 'id,title,body,audience,domain_id,pinned,link_url,published_at,expires_at,domain:domains(name)';

const H = 3600_000;
const M = 60_000;

export const eventEnd = (e: Pick<EventRow, 'starts_at' | 'ends_at'>) =>
  e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 3 * H;

export const isOver = (e: Pick<EventRow, 'starts_at' | 'ends_at'>, now = Date.now()) => now > eventEnd(e);

export type Phase = 'cancelled' | 'before' | 'open' | 'closed';

export function attendanceWindow(e: EventRow, now = Date.now()) {
  const start = new Date(e.starts_at).getTime();
  const opens = e.attendance_opens_at ? new Date(e.attendance_opens_at).getTime() : start - 30 * M;
  const closes = e.attendance_closes_at ? new Date(e.attendance_closes_at).getTime() : eventEnd(e);
  const phase: Phase = e.cancelled ? 'cancelled' : now < opens ? 'before' : now > closes ? 'closed' : 'open';
  return { opens, closes, phase };
}

/** supabase-js returns embedded relations as object OR single-item array depending on typing: normalise */
export function norm<T extends { domain?: unknown }>(row: T): T {
  const d = row.domain;
  return { ...row, domain: Array.isArray(d) ? (d[0] ?? null) : (d ?? null) } as T;
}
