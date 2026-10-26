/**
 * src/pages/member/Home.tsx   (route /app)
 * Greeting, next event, ID tile, nudges (notifications / backup PIN / install), latest updates.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { useLoad } from '../../hooks/useLoad';
import { usePush } from '../../hooks/usePush';
import { useQr } from '../../hooks/useQr';
import { ANN_COLS, EVENT_COLS, attendanceWindow, norm } from '../../lib/events';
import type { AnnouncementRow, EventRow } from '../../lib/events';
import { countdown, firstName, fmtTime, fmtWeekdayDate, isTodayIST, timeAgo } from '../../lib/format';
import { formatMemberNo, verifyUrl } from '../../lib/idcard';
import { dismissFor, dismissedUntil } from '../../lib/cache';
import {
  Avatar, Band, Banner, Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, MemberFoot, useToast,
} from '../../components/member/ui';
import InstallBanner from '../../components/InstallBanner';

type HomeData = {
  next: EventRow | null;
  attended: boolean;
  announcements: AnnouncementRow[];
  readIds: string[];
};

async function fetchHome(): Promise<HomeData> {
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const [ev, an, rd] = await Promise.all([
    supabase.from('events').select(EVENT_COLS).gte('starts_at', since).order('starts_at', { ascending: true }).limit(3),
    supabase.from('announcements').select(ANN_COLS).order('published_at', { ascending: false }).limit(3),
    supabase.from('announcement_reads').select('announcement_id'),
  ]);
  if (ev.error) throw ev.error;
  if (an.error) throw an.error;
  const events = ((ev.data ?? []) as unknown as EventRow[]).map(norm);
  const next = events[0] ?? null;

  let attended = false;
  if (next) {
    const a = await supabase.from('attendance').select('event_id').eq('event_id', next.id).maybeSingle();
    attended = !!a.data;
  }
  return {
    next,
    attended,
    announcements: ((an.data ?? []) as unknown as AnnouncementRow[]).map(norm),
    readIds: (rd.data ?? []).map((r) => r.announcement_id as string),
  };
}

export default function MemberHome() {
  const { member, roles, unread } = useReadyMember();
  const nav = useNavigate();
  const toast = useToast();
  const push = usePush();
  const { data, loading, error, fromCache, reload } = useLoad<HomeData>('home', fetchHome);

  // keep countdown text fresh
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const [pinDismissed, setPinDismissed] = useState(() => dismissedUntil('pin'));
  const [pushDismissed, setPushDismissed] = useState(() => dismissedUntil('push'));

  const qr = useQr(verifyUrl(member.public_id), 160);
  const next = data?.next ?? null;
  const win = next ? attendanceWindow(next, now) : null;
  const cd = next ? countdown(next.starts_at, next.ends_at, now) : null;
  const roleLabel = member.role === 'lead' ? 'Lead' : member.role === 'colead' ? 'Co-lead' : 'Member';
  const readSet = new Set(data?.readIds ?? []);

  const enablePush = async () => {
    const ok = await push.enable();
    if (ok) toast('Notifications turned on');
    else if (push.error === 'denied') toast('Notifications are blocked in browser settings');
  };

  const showPushCard = push.rawStatus === 'off' && !pushDismissed;
  const showPinCard = !member.has_pin && !pinDismissed;

  return (
    <section className="screen">
      <Band
        tone="blue" tall
        right={
          <div className="row" style={{ gap: 8 }}>
            <button className="iconbtn" onClick={() => nav('/app/announcements')} aria-label={unread ? `Updates, ${unread} unread` : 'Updates'}>
              <Ic n="bell" />{unread > 0 && <i className="dot" />}
            </button>
            <button className="avatar" onClick={() => nav('/app/profile')} aria-label="Profile" style={{ border: 0, padding: 0, cursor: 'pointer' }}>
              <Avatar name={member.name} path={member.photo_path} className="" style={{ width: '100%', height: '100%', display: 'block' }} />
            </button>
          </div>
        }
        eyebrow={`${member.domain_name ?? 'Sambhav'} · ${roleLabel}`}
        title={<span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Hi, {firstName(member.name)} 👋</span>}
      />

      {(error && !loading) && (
        <div className="banners">
          <Banner tone="warn">
            <strong>Couldn't refresh.</strong> {fromCache || data ? 'Showing the last saved data. ' : ''}
            <button className="linkbtn" onClick={() => void reload()}>Retry</button>
          </Banner>
        </div>
      )}

      {/* NEXT EVENT */}
      {loading && !data ? (
        <div className="nextcard"><div className="skel" style={{ minHeight: 120 }} /></div>
      ) : next ? (
        <div className="nextcard">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">Next up</span>
            {next.cancelled ? <Chip tone="pink">Cancelled</Chip> : cd && <span className="countdown"><i />{cd}</span>}
          </div>
          <h2 className="h3" style={{ fontSize: 22 }}>{next.title}</h2>
          <div className="meta">
            <span><Ic n="clock" />{isTodayIST(next.starts_at) ? 'Today' : fmtWeekdayDate(next.starts_at)}, {fmtTime(next.starts_at)}</span>
            {next.venue && <span><Ic n="pin" />{next.venue}</span>}
          </div>
          <div className="row" style={{ marginTop: 16, gap: 10 }}>
            {data?.attended ? (
              <Link className="btn btn--mint grow" to={`/app/events/${next.id}`} style={{ padding: '0 14px' }}>Checked in ✓</Link>
            ) : win?.phase === 'open' ? (
              <Link className="btn btn--blue grow" to={`/app/events/${next.id}`} style={{ padding: '0 14px' }}>Check in</Link>
            ) : (
              <Link className="btn btn--blue grow" to={`/app/events/${next.id}`} style={{ padding: '0 14px' }}>Open</Link>
            )}
            {(win?.phase === 'open' && !data?.attended) && (
              <Link className="btn btn--line" to={`/app/events/${next.id}`} style={{ padding: '0 18px' }}>Details</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="nextcard"><span className="eyebrow">Next up</span><p className="h3" style={{ marginTop: 10 }}>No upcoming events.</p><p className="small muted">New events show up here.</p></div>
      )}

      <div className="pad">
        {/* ID TILE */}
        <div className="sec">
          <Link className="idtile" to="/app/id">
            <span className="miniqr">{qr ? <img className="qrimg" src={qr} alt="" /> : null}</span>
            <span className="grow">
              <span className="eyebrow" style={{ color: 'var(--sun)' }}>My member ID</span>
              <span className="h3" style={{ display: 'block', marginTop: 4 }}>{formatMemberNo(member.member_no)}</span>
              <span className="small" style={{ opacity: 0.8 }}>Tap to show your card</span>
            </span>
            <Ic n="chev" />
          </Link>
        </div>

        {/* NUDGES */}
        {(showPushCard || showPinCard) && (
          <div className="sec">
            {showPushCard && (
              <div className="prompt prompt--sun">
                <span className="prompt__ic"><Ic n="bell" /></span>
                <span>
                  <span className="prompt__t" style={{ display: 'block' }}>Get notified</span>
                  <span className="prompt__p" style={{ display: 'block' }}>Event reminders and club updates.</span>
                </span>
                <Btn tone="ink" size="sm" style={{ marginLeft: 'auto', minHeight: 40, padding: '0 14px' }} loading={push.busy} onClick={enablePush}>Enable</Btn>
                <button className="x" aria-label="Dismiss" onClick={() => { dismissFor('push', 7); setPushDismissed(true); }}><Ic n="x" /></button>
              </div>
            )}
            {showPinCard && (
              <div className="prompt prompt--mint">
                <span className="prompt__ic"><Ic n="lock" /></span>
                <span>
                  <span className="prompt__t" style={{ display: 'block' }}>Set a backup PIN</span>
                  <span className="prompt__p" style={{ display: 'block' }}>Sign in even without Google.</span>
                </span>
                <Link className="btn btn--ink btn--sm" to="/app/set-pin" style={{ marginLeft: 'auto', minHeight: 40, padding: '0 14px' }}>Set</Link>
                <button className="x" aria-label="Dismiss" onClick={() => { dismissFor('pin', 7); setPinDismissed(true); }}><Ic n="x" /></button>
              </div>
            )}
          </div>
        )}
        <div className="sec"><InstallBanner dismissable /></div>

        {/* LATEST UPDATES */}
        <div className="sec">
          <div className="sec__head">
            <h2 className="h3">Latest updates</h2>
            <Link className="linkbtn" to="/app/announcements">See all</Link>
          </div>
          {loading && !data ? <ListSkeleton rows={2} /> : error && !data ? <LoadError onRetry={() => void reload()} /> :
            data && data.announcements.length === 0 ? (
              <EmptyState title="Nothing new yet." text="We'll notify you here." />
            ) : (
              data?.announcements.map((a) => {
                const isUnread = !readSet.has(a.id);
                return (
                  <Link className="item" key={a.id} to={`/app/announcements/${a.id}`}>
                    <span className={`item__ic ${a.audience === 'domain' ? 'item__ic--blue' : 'item__ic--sun'}`}><Ic n="mega" /></span>
                    <span className="grow">
                      <span className="item__t">{a.title}</span>
                      <span className="item__p" style={{ display: '-webkit-box' }}>{a.body}</span>
                      <span className="item__m">
                        <Chip tone={a.audience === 'domain' ? 'blue' : 'deep'} small>{a.audience === 'domain' ? (a.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
                        {timeAgo(a.published_at, now)}
                      </span>
                    </span>
                    {isUnread && <i className="unread" aria-label="Unread" />}
                  </Link>
                );
              })
            )}
        </div>

        {roles.length > 0 && (
          <div className="sec">
            <Link className="item" to="/app/lead" style={{ alignItems: 'center' }}>
              <span className="item__ic item__ic--sun"><Ic n="shield" /></span>
              <span className="grow"><span className="item__t">Lead tools</span><span className="small muted" style={{ display: 'block' }}>{roles[0].domain_name} · manage your domain</span></span>
              <Ic n="chev" />
            </Link>
          </div>
        )}
      </div>
      <MemberFoot title="Need a hand?" text="Something not working? Message the core team." />
    </section>
  );
}
