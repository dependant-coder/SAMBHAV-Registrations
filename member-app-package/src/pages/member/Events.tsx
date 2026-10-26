/**
 * src/pages/member/Events.tsx   (route /app/events)
 * Upcoming / Past tabs. Past shows whether the member attended. All times in IST.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { useLoad } from '../../hooks/useLoad';
import { EVENT_COLS, attendanceWindow, eventEnd, isOver, norm } from '../../lib/events';
import type { EventRow } from '../../lib/events';
import { fmtDayNum, fmtMonthShort, fmtTime, isTodayIST } from '../../lib/format';
import { Band, Chip, EmptyState, ListSkeleton, LoadError } from '../../components/member/ui';

type Data = { events: EventRow[]; attended: string[] };

async function fetchEvents(): Promise<Data> {
  const from = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [ev, at] = await Promise.all([
    supabase.from('events').select(EVENT_COLS).gte('starts_at', from).order('starts_at', { ascending: true }).limit(200),
    supabase.from('attendance').select('event_id'),
  ]);
  if (ev.error) throw ev.error;
  return {
    events: ((ev.data ?? []) as unknown as EventRow[]).map(norm),
    attended: (at.data ?? []).map((a) => a.event_id as string),
  };
}

export default function Events() {
  const { member } = useReadyMember();
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const { data, loading, error, reload } = useLoad<Data>('events', fetchEvents);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const { upcoming, past, att } = useMemo(() => {
    const att = new Set(data?.attended ?? []);
    const evs = data?.events ?? [];
    return {
      att,
      upcoming: evs.filter((e) => !isOver(e, now)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
      past: evs.filter((e) => isOver(e, now)).sort((a, b) => eventEnd(b) - eventEnd(a)),
    };
  }, [data, now]);

  const list = tab === 'up' ? upcoming : past;

  return (
    <section className="screen">
      <Band tone="mint" pb={40} eyebrow="What's happening" title="Events" />
      <div className="pad" style={{ marginTop: 18 }}>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'up'} onClick={() => setTab('up')}>Upcoming</button>
          <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past</button>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading && !data ? <ListSkeleton rows={3} /> :
            error && !data ? <LoadError onRetry={() => void reload()} /> :
              list.length === 0 ? (
                <EmptyState title={tab === 'up' ? 'No upcoming events.' : 'No past events yet.'} text={tab === 'up' ? 'New events show up here.' : undefined} />
              ) : list.map((e) => {
                const today = isTodayIST(e.starts_at);
                const w = attendanceWindow(e, now);
                const live = !e.cancelled && now >= new Date(e.starts_at).getTime() && !isOver(e, now);
                const attended = att.has(e.id);
                return (
                  <Link className="item" key={e.id} to={`/app/events/${e.id}`}>
                    <span className={`dateblk${today && tab === 'up' ? ' dateblk--sun' : ''}`}>
                      <b>{fmtMonthShort(e.starts_at)}</b><span>{fmtDayNum(e.starts_at)}</span>
                    </span>
                    <span className="grow">
                      <span className="item__t">{e.title}</span>
                      <span className="item__m" style={{ marginTop: 6 }}>
                        <span>{fmtTime(e.starts_at)}{e.venue ? ` · ${e.venue}` : ''}</span>
                      </span>
                      <span className="item__m" style={{ marginTop: 8 }}>
                        {e.cancelled && <Chip tone="pink" small>Cancelled</Chip>}
                        {!e.cancelled && live && <Chip tone="sun" small>Happening now</Chip>}
                        {!e.cancelled && !live && today && tab === 'up' && <Chip tone="sun" small>Today</Chip>}
                        {!e.cancelled && w.phase === 'open' && !attended && !live && tab === 'up' && <Chip tone="mint" small>Check-in open</Chip>}
                        <Chip tone={e.audience === 'domain' ? 'blue' : 'deep'} small>{e.audience === 'domain' ? (e.domain?.name ?? member.domain_name ?? 'Domain') : 'Everyone'}</Chip>
                        {attended && <Chip tone="mint" small>Attended ✓</Chip>}
                        {tab === 'past' && !attended && !e.cancelled && <Chip tone="deep" small>Missed</Chip>}
                      </span>
                    </span>
                  </Link>
                );
              })}
        </div>

        {tab === 'past' && list.length > 0 && (
          <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>Showing the last 90 days.</p>
        )}
      </div>
    </section>
  );
}
