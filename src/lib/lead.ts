/**
 * src/lib/lead.ts
 * Types and maths for the lead screens.
 */
export type DomainMember = {
  id: string;
  name: string;
  roll_number: string;
  phone: string | null;
  photo_path: string | null;
  on_app: boolean;
  has_notifications: boolean;
  attended: number;
  total_events: number;
};

/** attendance share 0..1, or null when there were no events yet */
export const rateOf = (m: Pick<DomainMember, 'attended' | 'total_events'>) =>
  m.total_events > 0 ? m.attended / m.total_events : null;

/** low = at least 3 events happened and under 50% attended */
export const isLow = (m: DomainMember) => m.total_events >= 3 && (rateOf(m) ?? 1) < 0.5;

export const needsNudge = (m: DomainMember) => isLow(m) || !m.on_app;

export function nudgeText(m: DomainMember) {
  const bits: string[] = [];
  if (m.total_events > 0 && isLow(m)) bits.push(`Attended ${m.attended} of ${m.total_events}`);
  if (!m.on_app) bits.push('not on the app');
  const s = bits.join(' · ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
