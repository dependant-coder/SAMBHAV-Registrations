/**
 * src/pages/lead/Dashboard.tsx   (route /app/lead)
 * Stats for the lead's own domain, the next event, and who needs a nudge.
 * Phone numbers come from lead_domain_members and are NEVER cached.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLead, DomainSwitcher } from '../../components/LeadGuard';
import { EVENT_COLS, norm } from '../../lib/events';
import type { EventRow } from '../../lib/events';
import { fmtDayNum, fmtMonthShort, fmtTime, isTodayIST, waLink } from '../../lib/format';
import { isLow, needsNudge, nudgeText, rateOf } from '../../lib/lead';
import type { DomainMember } from '../../lib/lead';
import { Avatar, Band, Chip, EmptyState, Ic, ListSkeleton, LoadError, Note } from '../../components/member/ui';

export default function LeadDashboard() {
  const { role } = useLead();
  const [members, setMembers] = useState<DomainMember[] | null>(null);
  const [next, setNext] = useState<EventRow | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const [m, e] = await Promise.all([
      supabase.rpc('lead_domain_members', { p_domain: role.domain_id }),
      supabase.from('events').select(EVENT_COLS).gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString()).eq('cancelled', false).order('starts_at').limit(8),
    ]);
    setLoading(false);
    if (m.error) { setError(true); return; }
    setMembers((m.data ?? []) as DomainMember[]);
    const evs = ((e.data ?? []) as unknown as EventRow[]).map(norm);
    setNext(evs.find((x) => x.audience === 'domain' && x.domain_id === role.domain_id) ?? evs[0] ?? null);
  }, [role.domain_id]);

  useEffect(() => { setMembers(null); void load(); }, [load]);

  const stats = useMemo(() => {
    const list = members ?? [];
    const withEvents = list.filter((m) => m.total_events > 0);
    const avg = withEvents.length
      ? Math.round((withEvents.reduce((s, m) => s + (rateOf(m) ?? 0), 0) / withEvents.length) * 100)
      : null;
    return {
      total: list.length,
      onApp: list.filter((m) => m.on_app).length,
      notif: list.filter((m) => m.has_notifications).length,
      avg,
      nudge: list.filter(needsNudge).sort((a, b) => (rateOf(a) ?? 1) - (rateOf(b) ?? 1)).slice(0, 5),
    };
  }, [members]);

  const roleLabel = role.role === 'lead' ? 'Lead' : 'Co-lead';
  const ownEvent = !!next && next.audience === 'domain' && next.domain_id === role.domain_id;

  return (
    <section className="screen">
      <Band tone="ink" pb={44} right={<Chip tone="sun">{roleLabel}</Chip>} eyebrow="Lead tools" title={role.domain_name} />
      <div className="pad" style={{ marginTop: 18 }}>
        <DomainSwitcher />

        {loading && !members ? <ListSkeleton rows={3} /> : error && !members ? <LoadError onRetry={() => void load()} /> : (
          <>
            <div className="stats" style={{ marginTop: 12 }}>
              <div className="stat stat--blue"><b>{stats.total}</b><span>Members</span></div>
              <div className="stat stat--sun"><b>{stats.onApp}<small style={{ fontSize: 18 }}> /{stats.total}</small></b><span>On the app</span></div>
              <div className="stat"><b>{stats.notif}<small style={{ fontSize: 18 }}> /{stats.total}</small></b><span>Notifications on</span></div>
              <div className="stat stat--mint"><b>{stats.avg == null ? '—' : `${stats.avg}%`}</b><span>Average attendance</span></div>
            </div>

            <div className="sec">
              <div className="sec__head"><h2 className="h3">Next event</h2></div>
              {next ? (
                <div className="card">
                  <div className="row" style={{ gap: 14 }}>
                    <span className={`dateblk${isTodayIST(next.starts_at) ? ' dateblk--sun' : ''}`}><b>{fmtMonthShort(next.starts_at)}</b><span>{fmtDayNum(next.starts_at)}</span></span>
                    <span className="grow">
                      <b style={{ display: 'block', lineHeight: 1.2 }}>{next.title}</b>
                      <span className="small muted">{fmtTime(next.starts_at)}{next.venue ? ` · ${next.venue}` : ''}</span>
                    </span>
                  </div>
                  <div className="row" style={{ gap: 10, marginTop: 14 }}>
                    {ownEvent && <Link className="btn btn--blue btn--sm grow" to={`/app/scan?event=${next.id}`}><Ic n="scan" />Scan IDs</Link>}
                    <Link className={`btn btn--line btn--sm${ownEvent ? '' : ' grow'}`} to={`/app/events/${next.id}`}>Open</Link>
                  </div>
                </div>
              ) : <EmptyState title="No upcoming events." text="Ask the core team to schedule one." />}
            </div>

            <div className="sec row" style={{ gap: 8 }}>
              <Link className="btn btn--ink grow" to="/app/lead/announcements?new=1" style={{ padding: '0 10px', fontSize: 15, gap: 6 }}><Ic n="plus" />Announcement</Link>
              <Link className="btn btn--white grow" to="/app/lead/events?new=1" style={{ padding: '0 10px', fontSize: 15, gap: 6 }}><Ic n="plus" />Event</Link>
            </div>

            <div className="sec">
              <div className="sec__head"><h2 className="h3">Needs a nudge</h2><Link className="linkbtn" to="/app/lead/members">All members</Link></div>
              {stats.total === 0 ? <EmptyState title="No members yet." /> : stats.nudge.length === 0 ? (
                <EmptyState title="Everyone's on track." text="Nobody needs a nudge right now." />
              ) : stats.nudge.map((m) => {
                const wa = waLink(m.phone, `Hi ${m.name.split(' ')[0]}, hope you're doing well! We missed you at our recent ${role.domain_name} sessions. Everything okay? `);
                return (
                  <div className="member" key={m.id}>
                    <Avatar name={m.name} path={m.photo_path} />
                    <span className="grow">
                      <span className="member__n">{m.name}</span>
                      <span className="member__s" style={{ display: 'block' }}>{nudgeText(m) || (isLow(m) ? 'Low attendance' : '')}</span>
                    </span>
                    {wa && <a className="smallbtn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${m.name}`}><Ic n="chat" /></a>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Note style={{ marginTop: 22 }}>You can see your own domain only. Approving members and changing details is done by the core team.</Note>
      </div>
    </section>
  );
}
