/**
 * src/lib/format.ts
 * Date, name and link helpers. Everything user-facing is formatted in IST (Asia/Kolkata),
 * regardless of the phone's own time zone.
 */
const TZ = 'Asia/Kolkata';

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o });
const fDay = fmt({ day: 'numeric', month: 'short' });
const fWeekday = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fTime = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const fMonth = fmt({ month: 'short' });
const fDayNum = fmt({ day: 'numeric' });
const fYmd = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
const fClock = fmt({ hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

const up = (s: string) => s.replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());

export const fmtDay = (d: string | Date) => fDay.format(new Date(d));
export const fmtTime = (d: string | Date) => up(fTime.format(new Date(d)));
export const fmtClock = (d: string | Date) => up(fClock.format(new Date(d)));
export const fmtWeekdayDate = (d: string | Date) => fWeekday.format(new Date(d)).replace(',', '');
export const fmtMonthShort = (d: string | Date) => fMonth.format(new Date(d)).toUpperCase();
export const fmtDayNum = (d: string | Date) => fDayNum.format(new Date(d));
export const fmtDateTime = (d: string | Date) => `${fmtWeekdayDate(d)} · ${fmtTime(d)}`;

/** yyyy-mm-dd in IST, used to compare "same calendar day" */
const ymd = (d: Date) => fYmd.format(d).split('/').reverse().join('-');
export const isTodayIST = (d: string | Date) => ymd(new Date(d)) === ymd(new Date());

export function fmtRange(start: string, end?: string | null) {
  const s = `${fmtWeekdayDate(start)} · ${fmtTime(start)}`;
  if (!end) return `${s} (IST)`;
  const sameDay = ymd(new Date(start)) === ymd(new Date(end));
  return sameDay ? `${s} – ${fmtTime(end)} (IST)` : `${s} – ${fmtWeekdayDate(end)} ${fmtTime(end)} (IST)`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDay(iso);
}

/** "in 2 hours", "in 25 min", "Happening now". Returns null if already over. */
export function countdown(startIso: string, endIso?: string | null, now = Date.now()) {
  const s = new Date(startIso).getTime();
  const e = endIso ? new Date(endIso).getTime() : s + 3 * 3600_000;
  if (now >= s && now <= e) return 'Happening now';
  if (now > e) return null;
  const m = Math.round((s - now) / 60000);
  if (m < 60) return `in ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

export function initialsOf(name: string) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there';

/** wa.me link: digits only, add 91 to a bare 10-digit Indian number. Returns null when there is no usable phone. */
export function waLink(phone?: string | null, text?: string) {
  const d = (phone ?? '').replace(/\D/g, '');
  if (!d) return null;
  const n = d.length === 10 ? `91${d}` : d.replace(/^0+/, '');
  if (n.length < 11) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telLink(phone?: string | null) {
  const d = (phone ?? '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : null;
}

export const isUuid = (s?: string | null) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Only ever follow http(s) links we got from the database. */
export const safeHttpUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

/** Split plain text into text + clickable http(s) links without ever using innerHTML. */
export function linkify(text: string): Array<{ t: string; href?: string }> {
  const out: Array<{ t: string; href?: string }> = [];
  const re = /https?:\/\/[^\s<>"']+/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    const trail = m[0].match(/[).,;!?]+$/)?.[0] ?? '';
    out.push({ t: m[0].slice(0, m[0].length - trail.length), href: m[0].slice(0, m[0].length - trail.length) });
    if (trail) out.push({ t: trail });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/* ---- IST <-> <input type="datetime-local"> ---- */
/** "2026-10-25T17:00" typed by the user is always read as IST, whatever the phone's zone is */
export const istLocalToIso = (v: string) => new Date(`${v}:00+05:30`).toISOString();
export const isoToIstLocal = (iso?: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : '';
