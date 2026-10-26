/**
 * src/pages/admin/Audit.tsx   (route /admin/audit)
 * Read-only: the latest 200 audit_log rows. Time in IST, actor name from members (fallback "Admin").
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminFrame, { AdminHeader } from '../../components/admin/AdminFrame';
import { fmtDateTime } from '../../lib/format';
import { EmptyState, Ic, ListSkeleton, LoadError } from '../../components/member/ui';

type Log = {
  id: number; at: string; actor_member_id: string | null; action: string;
  target_type: string | null; target_id: string | null; domain_id: string | null; details: Record<string, unknown> | null;
};

const WORDS: Record<string, string> = {
  role_set: 'Assigned a role', role_removed: 'Removed a role',
  pin_reset: 'Generated a temporary PIN', pin_removed: 'Removed a PIN', login_unlinked: 'Unlinked a login',
  id_regenerated: 'Regenerated an ID', checkin_code_regenerated: 'Made a new check-in code',
  push_sent: 'Sent a notification', announcements_deleted: 'Deleted an announcement', events_deleted: 'Deleted an event',
};
const word = (a: string) => WORDS[a] ?? a.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function detailText(l: Log) {
  const d = l.details ?? {};
  const bits: string[] = [];
  if (typeof d.title === 'string') bits.push(`"${d.title}"`);
  if (typeof d.role === 'string') bits.push(d.role === 'lead' ? 'Lead' : 'Co-lead');
  if (typeof d.sent === 'number') bits.push(`${d.sent} devices`);
  return bits.join(' · ');
}

function Inner() {
  const [rows, setRows] = useState<Log[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());          // member id -> name
  const [domains, setDomains] = useState<Map<string, string>>(new Map());
  const [targets, setTargets] = useState<Map<string, string>>(new Map());      // member id -> name for member targets
  const [error, setError] = useState(false);
  const [domain, setDomain] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setError(false);
    const [l, d] = await Promise.all([
      supabase.from('audit_log').select('id,at,actor_member_id,action,target_type,target_id,domain_id,details').order('at', { ascending: false }).limit(200),
      supabase.from('domains').select('id,name'),
    ]);
    if (l.error) { setError(true); return; }
    const list = (l.data ?? []) as Log[];
    setRows(list);
    setDomains(new Map(((d.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    const ids = [...new Set(list.flatMap((r) => [r.actor_member_id, r.target_type === 'member' ? r.target_id : null]).filter(Boolean) as string[])];
    if (ids.length) {
      const m = await supabase.from('members').select('id,name').in('id', ids);
      const map = new Map(((m.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
      setNames(map); setTargets(map);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const actions = useMemo(() => [...new Set((rows ?? []).map((r) => r.action))].sort(), [rows]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (domain && r.domain_id !== domain) return false;
      if (action && r.action !== action) return false;
      if (!s) return true;
      const actor = (r.actor_member_id && names.get(r.actor_member_id)) || 'admin';
      const target = (r.target_type === 'member' && r.target_id && targets.get(r.target_id)) || '';
      return actor.toLowerCase().includes(s) || target.toLowerCase().includes(s) || detailText(r).toLowerCase().includes(s);
    });
  }, [rows, domain, action, q, names, targets]);

  return (
    <>
      <AdminHeader eyebrow="Super admin only" title="Audit log" />
      <div className="adm__toolbar" style={{ gridTemplateColumns: undefined }}>
        <div className="control" style={{ marginTop: 0 }}>
          <input className="input" style={{ paddingLeft: 50 }} placeholder="Search by name or title" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <Ic n="search" style={{ position: 'absolute', left: 16, top: 18, color: 'var(--ink-soft)' }} />
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <select className="select" aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">All domains</option>
            {[...domains].map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <select className="select" aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{word(a)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {!rows && !error ? <ListSkeleton rows={5} /> : error ? <LoadError onRetry={() => void load()} /> :
          shown.length === 0 ? <EmptyState title="Nothing here." text="Actions by admins, leads and the system show up in this list." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="adm__table">
                <thead><tr><th>When (IST)</th><th>Who</th><th>What</th><th>About</th><th>Domain</th></tr></thead>
                <tbody>
                  {shown.map((r) => {
                    const target = r.target_type === 'member' && r.target_id ? targets.get(r.target_id) : null;
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.at)}</td>
                        <td>{(r.actor_member_id && names.get(r.actor_member_id)) || 'Admin'}</td>
                        <td><b>{word(r.action)}</b></td>
                        <td>{[target, detailText(r)].filter(Boolean).join(' · ') || (r.target_type ?? '—')}</td>
                        <td>{(r.domain_id && domains.get(r.domain_id)) || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>Showing the latest 200 entries.</p>
    </>
  );
}

export default function AdminAudit() {
  return <AdminFrame><Inner /></AdminFrame>;
}
