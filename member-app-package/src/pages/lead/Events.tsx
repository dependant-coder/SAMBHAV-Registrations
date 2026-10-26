/**
 * src/pages/lead/Events.tsx   (route /app/lead/events, ?new=1 opens the creator)
 * Upcoming / Past events with check-in counts. Events the core team made for "everyone" show here
 * as read-only (they open the normal member page, no edit buttons).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLead, DomainSwitcher } from '../../components/LeadGuard';
import EventForm from '../../components/forms/EventForm';
import { EVENT_COLS, eventEnd, isOver, norm } from '../../lib/events';
import type { EventRow } from '../../lib/events';
import { fmtDayNum, fmtMonthShort, fmtTime, isTodayIST } from '../../lib/format';
import { BackBar, Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, useToast } from '../../components/member/ui';

type Data = { events: EventRow[]; counts: Record<string, number>; total: number };

export default function LeadEvents() {
  const { role } = useLead();
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const creating = sp.get('new') === '1';

  const [tab, setTab] = useState<'up' | 'past'>('up');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [limit, setLimit] = useState(30);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    setError(false);
    const from = new Date(Date.now() - 120 * 86400_000).toISOString();
    const ev = await supabase.from('events').select(EVENT_COLS).gte('starts_at', from).order('starts_at', { ascending: true }).limit(300);
    if (ev.error) { setError(true); return; }
    const events = ((ev.data ?? []) as unknown as EventRow[]).map(norm)
      .filter((e) => e.audience === 'all' || e.domain_id === role.domain_id);       // this domain + "everyone" only

    // check-in counts for own-domain events (leads can read attendance of their own events)
    const own = events.filter((e) => e.domain_id === role.domain_id).map((e) => e.id);
    const counts: Record<string, number> = {};
    if (own.length) {
      const at = await supabase.from('attendance').select('event_id').in('event_id', own);
      (at.data ?? []).forEach((r) => { const k = r.event_id as string; counts[k] = (counts[k] ?? 0) + 1; });
    }
    const m = await supabase.rpc('lead_domain_members', { p_domain: role.domain_id });
    setData({ events, counts, total: Array.isArray(m.data) ? m.data.length : 0 });
  }, [role.domain_id]);

  useEffect(() => { setData(null); void load(); }, [load]);
  useEffect(() => setLimit(30), [tab, role.domain_id]);

  const { upcoming, past } = useMemo(() => {
    const evs = data?.events ?? [];
    return {
      upcoming: evs.filter((e) => !isOver(e, now)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
      past: evs.filter((e) => isOver(e, now)).sort((a, b) => eventEnd(b) - eventEnd(a)),
    };
  }, [data, now]);

  const list = tab === 'up' ? upcoming : past;
  const closeForm = () => { const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); };

  if (creating) {
    return (
      <section className="screen">
        <BackBar label="Events" onBack={closeForm} />
        <div className="pad" style={{ marginTop: 6 }}>
          <p className="eyebrow">New event</p>
          <h1 className="h2">Create for {role.domain_name}</h1>
          <DomainSwitcher />
          <EventForm
            fixedDomainId={role.domain_id} fixedDomainName={role.domain_name} onCancel={closeForm}
            onSaved={({ id }) => { toast('Event created'); nav(`/app/lead/events/${id}`, { replace: true }); }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <BackBar to="/app/lead" label="Lead tools" />
      <div className="pad" style={{ marginTop: 6 }}>
        <p className="eyebrow">{role.domain_name}</p>
        <h1 className="h2">Events</h1>
        <DomainSwitcher />
        <Link className="btn btn--ink btn--block" style={{ marginTop: 14 }} to="/app/lead/events?new=1"><Ic n="plus" />New event</Link>

        <div className="seg" role="tablist" style={{ marginTop: 16 }}>
          <button role="tab" aria-selected={tab === 'up'} onClick={() => setTab('up')}>Upcoming</button>
          <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past</button>
        </div>

        <div style={{ marginTop: 16 }}>
          {!data && !error ? <ListSkeleton rows={3} /> : error ? <LoadError onRetry={() => void load()} /> :
            list.length === 0 ? <EmptyState title={tab === 'up' ? 'No upcoming events.' : 'No past events.'} text={tab === 'up' ? 'Create one to get started.' : undefined} /> :
              list.slice(0, limit).map((e) => {
                const mine = e.audience === 'domain' && e.domain_id === role.domain_id;
                const n = data?.counts[e.id] ?? 0;
                const live = !e.cancelled && now >= new Date(e.starts_at).getTime() && !isOver(e, now);
                return (
                  <Link className="item" key={e.id} to={mine ? `/app/lead/events/${e.id}` : `/app/events/${e.id}`}>
                    <span className={`dateblk${isTodayIST(e.starts_at) && tab === 'up' ? ' dateblk--sun' : ''}`}>
                      <b>{fmtMonthShort(e.starts_at)}</b><span>{fmtDayNum(e.starts_at)}</span>
                    </span>
                    <span className="grow">
                      <span className="item__t">{e.title}</span>
                      <span className="item__m" style={{ marginTop: 6 }}><span>{fmtTime(e.starts_at)}{e.venue ? ` · ${e.venue}` : ''}</span></span>
                      <span className="item__m" style={{ marginTop: 8 }}>
                        {e.cancelled && <Chip tone="pink" small>Cancelled</Chip>}
                        {live && <Chip tone="sun" small>Happening now</Chip>}
                        {!mine && <Chip tone="deep" small>Everyone · read-only</Chip>}
                        {mine && !e.cancelled && (
                          <Chip tone="mint" small>{n}{data && data.total ? ` / ${data.total}` : ''} checked in</Chip>
                        )}
                      </span>
                    </span>
                  </Link>
                );
              })}
        </div>
        {list.length > limit && <Btn tone="line" block style={{ marginTop: 16 }} onClick={() => setLimit((l) => l + 30)}>Show more</Btn>}
      </div>
    </section>
  );
}
