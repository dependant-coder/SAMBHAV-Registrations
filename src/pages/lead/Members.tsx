/**
 * src/pages/lead/Members.tsx   (route /app/lead/members)
 * Search + filters over the lead's own domain. No edit, approve, PIN or email anywhere on this screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLead, DomainSwitcher } from '../../components/LeadGuard';
import { telLink, waLink } from '../../lib/format';
import { isLow, rateOf } from '../../lib/lead';
import type { DomainMember } from '../../lib/lead';
import { Avatar, BackBar, Btn, EmptyState, Ic, ListSkeleton, LoadError } from '../../components/member/ui';

type F = 'all' | 'off' | 'low';
const STEP = 50;

export default function LeadMembers() {
  const { role } = useLead();
  const [rows, setRows] = useState<DomainMember[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>('all');
  const [limit, setLimit] = useState(STEP);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setRows(null); setError(false);
    supabase.rpc('lead_domain_members', { p_domain: role.domain_id }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(true); else setRows((data ?? []) as DomainMember[]);
    });
    return () => { alive = false; };
  }, [role.domain_id, tick]);

  useEffect(() => setLimit(STEP), [q, f, role.domain_id]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((m) =>
      (!s || m.name.toLowerCase().includes(s) || m.roll_number.toLowerCase().includes(s)) &&
      (f === 'all' || (f === 'off' && !m.on_app) || (f === 'low' && isLow(m))));
  }, [rows, q, f]);

  return (
    <section className="screen">
      <BackBar to="/app/lead" label="Lead tools" />
      <div className="pad" style={{ marginTop: 6 }}>
        <p className="eyebrow">{role.domain_name}</p>
        <h1 className="h2">Members · {rows?.length ?? '…'}</h1>
        <DomainSwitcher />

        <div className="control">
          <input className="input" style={{ paddingLeft: 50 }} placeholder="Search name or roll no." aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <Ic n="search" style={{ position: 'absolute', left: 16, top: 18, color: 'var(--ink-soft)' }} />
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          <button className="fchip" aria-pressed={f === 'all'} onClick={() => setF('all')}>All</button>
          <button className="fchip" aria-pressed={f === 'off'} onClick={() => setF('off')}>Not on the app</button>
          <button className="fchip" aria-pressed={f === 'low'} onClick={() => setF('low')}>Low attendance</button>
        </div>

        <div style={{ marginTop: 14 }}>
          {!rows && !error ? <ListSkeleton rows={4} /> : error ? <LoadError onRetry={() => setTick((t) => t + 1)} /> :
            shown.length === 0 ? <EmptyState title={rows?.length ? 'No one matches.' : 'No members yet.'} /> :
              shown.slice(0, limit).map((m) => {
                const r = rateOf(m);
                const wa = waLink(m.phone, `Hi ${m.name.split(' ')[0]}, `);
                const tel = telLink(m.phone);
                return (
                  <div className="member" key={m.id}>
                    <Avatar name={m.name} path={m.photo_path} />
                    <span className="grow">
                      <span className="member__n">{m.name}</span>
                      <span className="member__s" style={{ display: 'block' }}>
                        {m.roll_number} · {m.on_app ? 'on app' : 'not on app'}{m.has_notifications ? ' · 🔔' : ''}
                      </span>
                      <div className={`rate${isLow(m) ? ' low' : ''}`}><i style={{ width: `${Math.round((r ?? 0) * 100)}%` }} /></div>
                    </span>
                    <b className="small">{r == null ? '—' : `${m.attended}/${m.total_events}`}</b>
                    {tel && <a className="smallbtn" href={tel} aria-label={`Call ${m.name}`} style={{ background: 'var(--sun)' }}><Ic n="phone" /></a>}
                    {wa && <a className="smallbtn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${m.name}`}><Ic n="chat" /></a>}
                  </div>
                );
              })}
        </div>

        {shown.length > limit && <Btn tone="line" block style={{ marginTop: 16 }} onClick={() => setLimit((l) => l + STEP)}>Show more</Btn>}
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: 16 }}>Emails are not shown. Phone numbers are for club use only.</p>
      </div>
    </section>
  );
}
