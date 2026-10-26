/**
 * src/pages/member/EventDetail.tsx   (route /app/events/:id)
 * Event info + the Attendance card. The browser only decides what to SHOW; check_in() decides what is true.
 * Deep link / QR: /app/events/<id>?code=ABC123 pre-fills the code but still needs a tap on "Check in".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { EVENT_COLS, attendanceWindow, norm } from '../../lib/events';
import type { EventRow } from '../../lib/events';
import { downloadIcs } from '../../lib/ics';
import { fmtDayNum, fmtMonthShort, fmtRange, fmtTime, isTodayIST, isUuid } from '../../lib/format';
import {
  BackBar, Btn, CellsInput, Chip, ErrorLine, Ic, ListSkeleton, LoadError, Note, useOnline, useToast,
} from '../../components/member/ui';

type CheckResult =
  | 'ok' | 'already' | 'wrong_code' | 'locked' | 'not_open_yet' | 'closed' | 'cancelled'
  | 'not_eligible' | 'not_approved' | 'not_member' | 'not_found';

const MESSAGES: Partial<Record<CheckResult, string>> = {
  wrong_code: "That code isn't right. Check the screen at the venue.",
  not_open_yet: 'Check-in is not open yet.',
  closed: 'Attendance is closed.',
  cancelled: 'This event was cancelled.',
  not_eligible: "You can't check in to this event.",
  not_approved: "You can't check in to this event.",
  not_member: "You can't check in to this event.",
  not_found: 'This event is not available anymore.',
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function EventDetail() {
  const { id } = useParams();
  useReadyMember();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const online = useOnline();

  const [ev, setEv] = useState<EventRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'error'>('loading');
  const [attendedAt, setAttendedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [justDone, setJustDone] = useState(false);
  const prefilled = useRef(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    if (!isUuid(id)) { setState('gone'); return; }
    setState('loading');
    const [e, a] = await Promise.all([
      supabase.from('events').select(EVENT_COLS).eq('id', id!).maybeSingle(),
      supabase.from('attendance').select('checked_in_at').eq('event_id', id!).maybeSingle(),
    ]);
    if (e.error) { setState('error'); return; }
    if (!e.data) { setState('gone'); return; }          // not for this member (RLS) or deleted
    setEv(norm(e.data as unknown as EventRow));
    setAttendedAt((a.data?.checked_in_at as string | undefined) ?? null);
    setState('ok');
  }, [id]);

  useEffect(() => { void load(); }, [load, tick]);

  // pre-fill from ?code= once, then strip it from the address bar
  useEffect(() => {
    if (prefilled.current) return;
    const c = sp.get('code');
    if (!c) return;
    prefilled.current = true;
    setCode(c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6));
    nav(`/app/events/${id}`, { replace: true });
  }, [sp, id, nav]);

  const win = ev ? attendanceWindow(ev, now) : null;
  const lockLeft = lockedUntil ? lockedUntil - now : 0;
  const locked = lockLeft > 0;
  useEffect(() => { if (lockedUntil && lockedUntil <= now) setLockedUntil(null); }, [lockedUntil, now]);

  const submit = async () => {
    if (!ev || busy || code.length < 6) return;
    if (!navigator.onLine) { setErr('No connection. Try again.'); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('check_in', { p_event: ev.id, p_code: code });
    setBusy(false);
    if (error) { setErr('No connection. Try again.'); return; }       // never show success on a failure
    const r = (data as { result?: CheckResult; until?: string } | null) ?? {};
    switch (r.result) {
      case 'ok':
        setAttendedAt(new Date().toISOString()); setJustDone(true); setCode('');
        void load();
        return;
      case 'already':
        setAttendedAt(new Date().toISOString()); toast("You're already checked in."); void load();
        return;
      case 'locked':
        setLockedUntil(r.until ? new Date(r.until).getTime() : Date.now() + 10 * 60_000);
        setErr(null); return;
      case 'not_open_yet': case 'closed': case 'cancelled':
        setErr(MESSAGES[r.result] ?? null); void load(); return;
      default:
        setErr((r.result && MESSAGES[r.result]) || "Couldn't check in. Try again.");
    }
  };

  return (
    <section className="screen">
      <BackBar to="/app/events" label="Events" />
      <div className="pad">
        {state === 'loading' && <div style={{ marginTop: 16 }}><ListSkeleton rows={2} /></div>}
        {state === 'error' && <div style={{ marginTop: 16 }}><LoadError onRetry={() => setTick((t) => t + 1)} /></div>}
        {state === 'gone' && (
          <div className="stack" style={{ marginTop: 16 }}>
            <Note tone="warn">This event isn't available anymore.</Note>
            <Link className="btn btn--ink btn--block" to="/app/events">Back to events</Link>
          </div>
        )}

        {state === 'ok' && ev && win && (
          <>
            <div className="row" style={{ marginTop: 14, gap: 14, alignItems: 'flex-start' }}>
              <span className={`dateblk${isTodayIST(ev.starts_at) ? ' dateblk--sun' : ''}`}>
                <b>{fmtMonthShort(ev.starts_at)}</b><span>{fmtDayNum(ev.starts_at)}</span>
              </span>
              <div className="grow">
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Chip tone={ev.audience === 'domain' ? 'blue' : 'deep'}>{ev.audience === 'domain' ? (ev.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
                  {ev.cancelled && <Chip tone="pink">Cancelled</Chip>}
                  {!ev.cancelled && isTodayIST(ev.starts_at) && <Chip tone="sun">Today</Chip>}
                </div>
              </div>
            </div>

            <h1 className="title-lg">{ev.title}</h1>
            <div className="meta" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
              <span><Ic n="clock" />{fmtRange(ev.starts_at, ev.ends_at)}</span>
              {ev.venue && <span><Ic n="pin" />{ev.venue}</span>}
              <span><Ic n="users" />{ev.audience === 'domain' ? `For ${ev.domain?.name ?? 'your domain'} members` : 'For all members'}</span>
            </div>
            {ev.description && <div className="prose"><p>{ev.description}</p></div>}

            <Btn tone="line" block style={{ marginTop: 18 }} onClick={() => { downloadIcs(ev); toast('Calendar file downloaded'); }}>
              <Ic n="cal" />Add to calendar
            </Btn>

            {/* ---------------- Attendance card ---------------- */}
            {ev.cancelled ? (
              <div className="att" style={{ background: 'var(--berry)' }}>
                <p className="eyebrow" style={{ color: 'var(--sun)' }}>Cancelled</p>
                <h2 className="att__t" style={{ marginTop: 6 }}>This event was cancelled</h2>
                <p className="att__p">Watch Updates for the new date.</p>
              </div>
            ) : attendedAt ? (
              <div className="att" aria-live="polite">
                <div className="okbig">
                  <i><Ic n="check" /></i>
                  <div>
                    <h2 className="att__t">{justDone ? "You're checked in!" : "You're checked in ✓"}</h2>
                    <p className="att__p" style={{ marginTop: 2 }}>Recorded at {fmtTime(attendedAt)}.{justDone ? ' See you inside.' : ''}</p>
                  </div>
                </div>
              </div>
            ) : win.phase === 'before' ? (
              <div className="att">
                <p className="eyebrow" style={{ color: 'var(--sun)' }}>Attendance</p>
                <h2 className="att__t" style={{ marginTop: 6 }}>Check-in opens at {fmtTime(new Date(win.opens))}</h2>
                <p className="att__p">Come back then and enter the code shown on the screen at the venue.</p>
                <Btn tone="white" block disabled>Check in</Btn>
              </div>
            ) : win.phase === 'closed' ? (
              <div className="att" style={{ background: 'var(--ink-soft)' }}>
                <p className="eyebrow" style={{ color: 'var(--sun)' }}>Attendance</p>
                <h2 className="att__t" style={{ marginTop: 6 }}>Attendance is closed</h2>
                <p className="att__p">Check-in ended at {fmtTime(new Date(win.closes))}. If you were there, tell your lead and they can add you.</p>
              </div>
            ) : (
              <div className="att">
                <p className="eyebrow" style={{ color: 'var(--sun)' }}>Attendance · open now</p>
                <h2 className="att__t" style={{ marginTop: 6 }}>Enter the code at the venue</h2>
                <p className="att__p">6 characters, shown on the screen or by your lead.</p>
                <div style={{ marginTop: 14 }}>
                  <CellsInput label="Check-in code" mode="code" codeStyle length={6} value={code} onChange={(v) => { setCode(v); setErr(null); }} error={!!err} onEnter={submit} />
                </div>
                {err && <ErrorLine>{err}</ErrorLine>}
                {locked && <ErrorLine>Too many wrong tries. Wait 10 minutes and try again.</ErrorLine>}
                {locked ? (
                  <Btn tone="white" block disabled>Try again in {mmss(lockLeft)}</Btn>
                ) : (
                  <Btn tone="sun" block loading={busy} disabled={!online || code.length < 6} onClick={submit}>Check in</Btn>
                )}
                <p className="tiny" style={{ marginTop: 12, opacity: 0.75 }}>Opened a QR link? The code is filled in for you. Just tap Check in.</p>
              </div>
            )}

            {!online && <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>You're offline. Check-in needs internet.</p>}
          </>
        )}
      </div>
    </section>
  );
}
