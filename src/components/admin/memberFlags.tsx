/**
 * src/components/admin/memberFlags.tsx
 * For the existing admin Members list:
 *   const flags = useMemberFlags();                       // one fetch for the whole list
 *   <MemberBadges flags={flags} memberId={m.id} />        // next to the name
 *   rows.filter(f => passesFlagFilter(filter, flags, m.id))  // filter: '' | 'not_on_app' | 'staff'
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Chip } from '../member/ui';
import '../../styles/admin.css';

export type Flag = { on_app: boolean; has_pin: boolean; has_notifications: boolean; role: 'lead' | 'colead' | null };
export type Flags = { map: Map<string, Flag>; ready: boolean; reload: () => void };
export type FlagFilter = '' | 'not_on_app' | 'staff';

export function useMemberFlags(): Flags {
  const [map, setMap] = useState<Map<string, Flag>>(new Map());
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const [f, r] = await Promise.all([
      supabase.rpc('admin_members_app_flags'),
      supabase.from('domain_roles').select('member_id,role'),
    ]);
    const m = new Map<string, Flag>();
    ((f.data ?? []) as { member_id: string; on_app?: boolean; has_pin?: boolean; has_notifications?: boolean }[]).forEach((x) =>
      m.set(x.member_id, { on_app: !!x.on_app, has_pin: !!x.has_pin, has_notifications: !!x.has_notifications, role: null }));
    ((r.data ?? []) as { member_id: string; role: 'lead' | 'colead' }[]).forEach((x) => {
      const cur = m.get(x.member_id) ?? { on_app: false, has_pin: false, has_notifications: false, role: null };
      m.set(x.member_id, { ...cur, role: x.role });
    });
    setMap(m); setReady(!f.error);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { map, ready, reload: () => void load() };
}

export function MemberBadges({ flags, memberId }: { flags: Flags; memberId: string }) {
  if (!flags.ready) return null;
  const f = flags.map.get(memberId);
  return (
    <span className="mapp-root" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', marginLeft: 6 }}>
      {f?.role && <Chip tone="sun" small>{f.role === 'lead' ? 'Lead' : 'Co-lead'}</Chip>}
      {f?.on_app && <Chip tone="mint" small>App ✓</Chip>}
      {f?.has_pin && <Chip tone="blue" small>PIN</Chip>}
      {f?.has_notifications && <Chip tone="deep" small>🔔</Chip>}
    </span>
  );
}

export function passesFlagFilter(filter: FlagFilter, flags: Flags, memberId: string) {
  if (!filter || !flags.ready) return true;
  const f = flags.map.get(memberId);
  return filter === 'not_on_app' ? !f?.on_app : !!f?.role;
}

export function FlagFilterSelect({ value, onChange }: { value: FlagFilter; onChange: (v: FlagFilter) => void }) {
  return (
    <span className="mapp-root adm adm--embed">
      <select className="select" aria-label="App filter" value={value} onChange={(e) => onChange(e.target.value as FlagFilter)}>
        <option value="">All members</option><option value="not_on_app">Not on the app yet</option><option value="staff">Leads &amp; co-leads</option>
      </select>
    </span>
  );
}
