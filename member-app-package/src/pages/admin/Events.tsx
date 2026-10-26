/**
 * src/pages/admin/Events.tsx   (route /admin/events, ?new=1 opens the creator)
 * Upcoming / Past with attendance counts ("37 / 52"). Detail lives in /admin/events/:id (AdminEventDetail).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminFrame, { AdminHeader } from '../../components/admin/AdminFrame';
import EventForm from '../../components/forms/EventForm';
import { EVENT_COLS, eventEnd, isOver, norm } from '../../lib/events';
import type { EventRow } from '../../lib/events';
import { fmtDayNum, fmtMonthShort, fmtTime, isTodayIST } from '../../lib/format';
import { Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, useToast } from '../../components/member/ui';

type Data = { events: EventRow[]; counts: Record<string, number>; eligibleAll: number; eligibleByDomain: Record<string, number> };

function Inner() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const creating = sp.get('new') === '1';
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [limit, setLimit] = useState(40);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    setError(false);
    const [ev, at, mm] = await Promise.all([
      supabase.from('events').select(EVENT_COLS).order('starts_at', { ascending: false }).limit(300),
      supabase.from('attendance').select('event_id'),
      supabase.from('members').select('domain_id').eq('status', 'approved'),
    ]);
    if (ev.error) { setError(true); return; }
    const counts: Record<string, number> = {};
    (at.data ?? []).forEach((r) => { const k = r.event_id as string; counts[k] = (counts[k] ?? 0) + 1; });
    const byDomain: Record<string, number> = {};
    (mm.data ?? []).forEach((m) => { const k = m.domain_id as string | null; if (k) byDomain[k] = (byDomain[k] ?? 0) + 1; });
    setData({ events: ((ev.data ?? []) as unknown as EventRow[]).map(norm), counts, eligibleAll: (mm.data ?? []).length, eligibleByDomain: byDomain });
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setLimit(40), [tab]);

  const { upcoming, past } = useMemo(() => {
    const evs = data?.events ?? [];
    return {
      upcoming: evs.filter((e) => !isOver(e, now)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
      past: evs.filter((e) => isOver(e, now)).sort((a, b) => eventEnd(b) - eventEnd(a)),
    };
  }, [data, now]);
  const list = tab === 'up' ? upcoming : past;
  const closeForm = () => { const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); };

  useEffect(() => {
    if (!creating) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [creating]);

  if (creating) {
    return (
      <>
        <AdminHeader eyebrow="New event" title="Create event" />
        <div style={{ maxWidth: 640 }}>
          <EventForm onCancel={closeForm} onSaved={({ id }) => { toast('Event created'); nav(`/admin/events/${id}`, { replace: true }); }} />
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader eyebrow="Members app" title="Events" right={<Btn tone="ink" onClick={() => setSp({ new: '1' })}><Ic n="plus" />New event</Btn>} />
      <div className="seg" role="tablist" style={{ maxWidth: 360 }}>
        <button role="tab" aria-selected={tab === 'up'} onClick={() => setTab('up')}>Upcoming</button>
        <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past</button>
      </div>

      <div style={{ marginTop: 16 }}>
        {!data && !error ? <ListSkeleton rows={4} /> : error ? <LoadError onRetry={() => void load()} /> :
          list.length === 0 ? <EmptyState title={tab === 'up' ? 'No upcoming events.' : 'No past events.'} /> : (
            <div className="adm__grid">
              {list.slice(0, limit).map((e) => {
                const total = e.audience === 'domain' && e.domain_id ? (data?.eligibleByDomain[e.domain_id] ?? 0) : (data?.eligibleAll ?? 0);
                const n = data?.counts[e.id] ?? 0;
                const live = !e.cancelled && now >= new Date(e.starts_at).getTime() && !isOver(e, now);
                return (
                  <Link className="item" key={e.id} to={`/admin/events/${e.id}`}>
                    <span className={`dateblk${isTodayIST(e.starts_at) && tab === 'up' ? ' dateblk--sun' : ''}`}><b>{fmtMonthShort(e.starts_at)}</b><span>{fmtDayNum(e.starts_at)}</span></span>
                    <span className="grow">
                      <span className="item__t">{e.title}</span>
                      <span className="item__m" style={{ marginTop: 6 }}><span>{fmtTime(e.starts_at)}{e.venue ? ` · ${e.venue}` : ''}</span></span>
                      <span className="item__m" style={{ marginTop: 8 }}>
                        {e.cancelled && <Chip tone="pink" small>Cancelled</Chip>}
                        {live && <Chip tone="sun" small>Happening now</Chip>}
                        <Chip tone={e.audience === 'domain' ? 'blue' : 'deep'} small>{e.audience === 'domain' ? (e.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
                        {!e.cancelled && <Chip tone="mint" small>{n} / {total} checked in</Chip>}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
      </div>
      {list.length > limit && <Btn tone="line" block style={{ marginTop: 16 }} onClick={() => setLimit((l) => l + 40)}>Show more</Btn>}
    </>
  );
}

export default function AdminEvents() {
  return <AdminFrame><Inner /></AdminFrame>;
}
