/**
 * src/components/EventManager.tsx
 * The whole "manage ONE event" screen, shared by the lead app (scope="lead") and the admin panel (scope="admin"):
 * check-in code + QR, attendance list, mark present, remove, not-yet-checked-in, CSV export, edit, cancel, delete.
 * Everything is re-checked by the database (RLS); the scope only changes what the UI offers.
 *   lead : needs allowedDomainIds (the domains the person leads). Members come from lead_domain_members.
 *   admin: can manage every event. Members come straight from the members table.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import EventForm from './forms/EventForm';
import ConfirmSheet from './member/ConfirmSheet';
import { useQr } from '../hooks/useQr';
import { EVENT_COLS, attendanceWindow, norm } from '../lib/events';
import type { EventRow } from '../lib/events';
import { downloadCsv, toCsv } from '../lib/csv';
import { fmtDateTime, fmtDayNum, fmtMonthShort, fmtRange, fmtTime, isTodayIST, isUuid, waLink } from '../lib/format';
import { siteUrl } from '../lib/idcard';
import type { DomainMember } from '../lib/lead';
import type { ReactNode } from 'react';
import {
  Avatar, BackBar, Btn, Chip, EmptyState, ErrorLine, FixedPortal, Ic, ListSkeleton, LoadError, Note, useToast,
} from './member/ui';

type Att = { member_id: string; checked_in_at: string; method: 'code' | 'admin' | 'scan' };

const METHOD: Record<Att['method'], string> = { code: 'code', admin: 'manual', scan: 'scan' };

/** Full-screen white code + QR for a projector or a phone held up in the room */
function CodeScreen({ code, qr, title, onClose }: { code: string; qr: string | null; title: string; onClose: () => void }) {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch { /* optional */ }
    };
    void ask();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const vis = () => { if (document.visibilityState === 'visible') void ask(); };
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', vis); void lock?.release().catch(() => {}); };
  }, [onClose]);
  return (
    <FixedPortal>
      <div className="ov ov--white" role="dialog" aria-modal="true" aria-label="Check-in code" onClick={onClose}>
        <div className="ov__col">
          <button className="close" aria-label="Close" onClick={onClose}><Ic n="x" /></button>
          <p className="eyebrow">{title}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(56px,20vw,110px)', lineHeight: 1, letterSpacing: '.06em', color: 'var(--ink)' }}>{code}</p>
          {qr && <div className="qrbig" style={{ width: 'min(60vw,260px)' }}><img className="qrimg" src={qr} alt="QR code that fills in the check-in code" /></div>}
          <p className="small muted">Members open the app, go to this event and enter the code. Tap anywhere to close.</p>
        </div>
      </div>
    </FixedPortal>
  );
}

type Props = {
  scope: 'lead' | 'admin';
  /** lead only: domain ids this person leads */
  allowedDomainIds?: string[];
  /** lead only: name used for the CSV domain column when the event has no domain */
  fallbackDomainName?: string;
  /** rendered above the title (the lead app passes its domain switcher here) */
  header?: ReactNode;
};

const PATHS = {
  lead: { list: '/app/lead/events', scan: '/app/scan', announce: '/app/lead/announcements', member: (id: string) => `/app/events/${id}` },
  admin: { list: '/admin/events', scan: '/admin/scan', announce: '/admin/announcements', member: (id: string) => `/admin/events/${id}` },
} as const;

export default function EventManager({ scope, allowedDomainIds, fallbackDomainName, header }: Props) {
  const { id } = useParams();
  const P = PATHS[scope];
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const editing = sp.get('edit') === '1';

  const [ev, setEv] = useState<EventRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'error'>('loading');
  const [code, setCode] = useState<string | null>(null);
  const [att, setAtt] = useState<Att[]>([]);
  const [members, setMembers] = useState<Array<DomainMember & { domain_id?: string | null }>>([]);
  const [domainNames, setDomainNames] = useState<Map<string, string>>(new Map());
  const [now, setNow] = useState(Date.now());
  const [tick, setTick] = useState(0);

  const [q, setQ] = useState('');
  const [pq, setPq] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState(false);

  const [removing, setRemoving] = useState<Att | null>(null);
  const [regen, setRegen] = useState(false);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [announceAsk, setAnnounceAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uid = useRef<string | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { uid.current = data.session?.user.id ?? null; }); }, []);

  const loadAtt = useCallback(async () => {
    if (!isUuid(id)) return;
    const { data, error } = await supabase.from('attendance').select('member_id,checked_in_at,method').eq('event_id', id!).order('checked_in_at', { ascending: false });
    if (!error) setAtt((data ?? []) as Att[]);
  }, [id]);

  const load = useCallback(async () => {
    if (!isUuid(id)) { setState('gone'); return; }
    setState('loading');
    const e = await supabase.from('events').select(EVENT_COLS).eq('id', id!).maybeSingle();
    if (e.error) { setState('error'); return; }
    if (!e.data) { setState('gone'); return; }
    const row = norm(e.data as unknown as EventRow);
    setEv(row);
    if (scope === 'lead' && (row.audience !== 'domain' || !row.domain_id || !(allowedDomainIds ?? []).includes(row.domain_id))) { setState('ok'); return; }   // read-only view
    const membersReq = scope === 'lead'
      ? supabase.rpc('lead_domain_members', { p_domain: row.domain_id })
      : (() => {
        let q = supabase.from('members').select('id,name,roll_number,phone,photo_path,domain_id').eq('status', 'approved').order('name');
        if (row.audience === 'domain' && row.domain_id) q = q.eq('domain_id', row.domain_id);
        return q;
      })();
    const [c, a, m, d] = await Promise.all([
      supabase.from('event_codes').select('code').eq('event_id', id!).maybeSingle(),
      supabase.from('attendance').select('member_id,checked_in_at,method').eq('event_id', id!).order('checked_in_at', { ascending: false }),
      membersReq,
      supabase.from('domains').select('id,name'),
    ]);
    setDomainNames(new Map(((d.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])));
    setCode((c.data?.code as string | undefined) ?? null);
    setAtt((a.data ?? []) as Att[]);
    setMembers(((Array.isArray(m.data) ? m.data : []) as Array<Partial<DomainMember> & { id: string; name: string; roll_number: string; domain_id?: string | null }>).map((x) => ({
      id: x.id, name: x.name, roll_number: x.roll_number, phone: x.phone ?? null, photo_path: x.photo_path ?? null,
      on_app: x.on_app ?? false, has_notifications: x.has_notifications ?? false, attended: x.attended ?? 0, total_events: x.total_events ?? 0,
      domain_id: x.domain_id ?? row.domain_id,
    })));
    setState('ok');
  }, [id, scope, allowedDomainIds]);

  useEffect(() => { void load(); }, [load, tick]);

  // keep the attendance list fresh while the page is open
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void loadAtt(); }, 15_000);
    return () => clearInterval(t);
  }, [loadAtt]);

  const editable = !!ev && (scope === 'admin' || (ev.audience === 'domain' && (allowedDomainIds ?? []).includes(ev.domain_id ?? '')));
  const win = ev ? attendanceWindow(ev, now) : null;
  const qr = useQr(ev && code ? `${siteUrl()}/app/events/${ev.id}?code=${code}` : null, 400);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const present = useMemo(() => new Set(att.map((a) => a.member_id)), [att]);
  const missing = useMemo(() => members.filter((m) => !present.has(m.id)), [members, present]);

  const attRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return att.filter((a) => {
      if (!s) return true;
      const m = byId.get(a.member_id);
      return !!m && (m.name.toLowerCase().includes(s) || m.roll_number.toLowerCase().includes(s));
    });
  }, [att, q, byId]);

  const candidates = useMemo(() => {
    const s = pq.trim().toLowerCase();
    if (!s) return [];
    return missing.filter((m) => m.name.toLowerCase().includes(s) || m.roll_number.toLowerCase().includes(s)).slice(0, 6);
  }, [missing, pq]);

  const fail = (e: { message?: string } | null) => {
    const m = e?.message ?? '';
    setErr(/row-level security|permission denied|42501|forbidden/i.test(m) ? 'You no longer have access to this event.' : "Couldn't do that. Try again.");
  };

  const markPresent = async (m: DomainMember) => {
    if (!ev || !uid.current || busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from('attendance').insert({ event_id: ev.id, member_id: m.id, method: 'admin', marked_by: uid.current });
    setBusy(false);
    if (error && !/duplicate|23505/i.test(error.message)) { fail(error); return; }
    toast(`${m.name} marked present`); setPq(''); void loadAtt();
  };

  const removeAtt = async () => {
    if (!ev || !removing) return;
    setBusy(true);
    const { error } = await supabase.from('attendance').delete().eq('event_id', ev.id).eq('member_id', removing.member_id);
    setBusy(false);
    if (error) fail(error); else { toast('Check-in removed'); void loadAtt(); }
    setRemoving(null);
  };

  const regenerate = async () => {
    if (!ev) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('admin_regen_checkin_code', { p_event: ev.id });
    setBusy(false); setRegen(false);
    if (error) { fail(error); return; }
    setCode(data as string); toast('New code created');
  };

  const setCancelled = async (value: boolean) => {
    if (!ev) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from('events').update({ cancelled: value }).eq('id', ev.id);
    setBusy(false); setCancelAsk(false);
    if (error) { fail(error); return; }
    setEv({ ...ev, cancelled: value });
    toast(value ? 'Event cancelled' : 'Event restored');
    if (value) setAnnounceAsk(ev.title);
  };

  const deleteEvent = async () => {
    if (!ev) return;
    setBusy(true);
    const { error } = await supabase.from('events').delete().eq('id', ev.id);
    setBusy(false); setDeleteAsk(false);
    if (error) { fail(error); return; }
    toast('Event deleted'); nav(P.list, { replace: true });
  };

  const exportCsv = () => {
    if (!ev) return;
    const rows = [...att].reverse().map((a) => {
      const m = byId.get(a.member_id);
      return [m?.roll_number ?? '', m?.name ?? 'Former member', (m?.domain_id && domainNames.get(m.domain_id)) || ev.domain?.name || fallbackDomainName || '', fmtDateTime(a.checked_in_at), METHOD[a.method]];
    });
    downloadCsv(`${ev.title.replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}-attendance.csv`, toCsv(['Roll number', 'Name', 'Domain', 'Checked in (IST)', 'Method'], rows));
  };

  const closeEdit = () => { const n = new URLSearchParams(sp); n.delete('edit'); setSp(n, { replace: true }); };

  /* ---------------- states ---------------- */
  if (state === 'loading') return <section className="screen"><BackBar to={P.list} label="Events" /><div className="pad" style={{ marginTop: 16 }}><ListSkeleton rows={3} /></div></section>;
  if (state === 'error') return <section className="screen"><BackBar to={P.list} label="Events" /><div className="pad" style={{ marginTop: 16 }}><LoadError onRetry={() => setTick((t) => t + 1)} /></div></section>;
  if (state === 'gone' || !ev) {
    return (
      <section className="screen"><BackBar to={P.list} label="Events" />
        <div className="pad stack" style={{ marginTop: 16 }}>
          <Note tone="warn">This event isn't available anymore.</Note>
          <Link className="btn btn--ink btn--block" to={P.list}>Back to events</Link>
        </div>
      </section>
    );
  }
  if (!editable) {
    return (
      <section className="screen"><BackBar to={P.list} label="Events" />
        <div className="pad stack" style={{ marginTop: 16 }}>
          <Note>This event is managed by the core team, so it is read-only here.</Note>
          <Link className="btn btn--ink btn--block" to={P.member(ev.id)}>See event details</Link>
        </div>
      </section>
    );
  }

  if (editing) {
    return (
      <section className="screen">
        <BackBar label="Event" onBack={closeEdit} />
        <div className="pad" style={{ marginTop: 6 }}>
          <p className="eyebrow">Edit event</p>
          <h1 className="h2">{ev.title}</h1>
          <EventForm
            {...(scope === 'lead' ? { fixedDomainId: ev.domain_id!, fixedDomainName: ev.domain?.name } : {})}
            initial={ev}
            onCancel={closeEdit}
            onSaved={({ title, justCancelled }) => { toast('Changes saved'); closeEdit(); setTick((t) => t + 1); if (justCancelled) setAnnounceAsk(title); }}
          />
        </div>
      </section>
    );
  }

  const phaseText =
    win?.phase === 'cancelled' ? 'Cancelled'
      : win?.phase === 'before' ? `Opens at ${fmtTime(new Date(win.opens))}`
        : win?.phase === 'open' ? 'Attendance is OPEN'
          : 'Attendance closed';

  return (
    <section className="screen">
      <BackBar to={P.list} label="Events" />
      <div className="pad">
        {header}
        <div className="row" style={{ marginTop: 14, gap: 14, alignItems: 'flex-start' }}>
          <span className={`dateblk${isTodayIST(ev.starts_at) ? ' dateblk--sun' : ''}`}><b>{fmtMonthShort(ev.starts_at)}</b><span>{fmtDayNum(ev.starts_at)}</span></span>
          <div className="grow row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Chip tone={ev.audience === 'domain' ? 'blue' : 'deep'}>{ev.audience === 'domain' ? (ev.domain?.name ?? fallbackDomainName ?? 'Domain') : 'Everyone'}</Chip>
            {ev.cancelled && <Chip tone="pink">Cancelled</Chip>}
          </div>
        </div>
        <h1 className="title-lg">{ev.title}</h1>
        <div className="meta" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
          <span><Ic n="clock" />{fmtRange(ev.starts_at, ev.ends_at)}</span>
          {ev.venue && <span><Ic n="pin" />{ev.venue}</span>}
        </div>
        {ev.description && <div className="prose"><p>{ev.description}</p></div>}

        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <Link className="btn btn--blue grow" to={`${P.scan}?event=${ev.id}`}><Ic n="scan" />Scan IDs</Link>
          <Link className="btn btn--line" to="?edit=1">Edit</Link>
        </div>

        {err && <ErrorLine>{err}</ErrorLine>}

        {/* ---------- code panel ---------- */}
        <div className="att">
          <p className="eyebrow" style={{ color: 'var(--sun)' }}>Check-in code · {phaseText}</p>
          {code ? (
            <>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px,15cqw,64px)', lineHeight: 1.1, letterSpacing: '.08em', marginTop: 10 }}>{code}</p>
              {qr && <div style={{ width: 150, marginTop: 12, padding: 8, borderRadius: 16, background: '#fff' }}><img className="qrimg" src={qr} alt="QR code that fills in the check-in code" /></div>}
              <p className="att__p">Show this to the room. Members enter it on the event page, or scan the QR with their phone camera.</p>
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Btn tone="sun" size="sm" onClick={() => setScreen(true)}>Show on screen</Btn>
                <Btn tone="white" size="sm" onClick={() => setRegen(true)}>New code</Btn>
              </div>
            </>
          ) : <p className="att__p">The code isn't available. Try again in a moment.</p>}
        </div>

        {/* ---------- attendance ---------- */}
        <div className="sec">
          <div className="sec__head">
            <h2 className="h3">Attendance</h2>
            <b style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22 }}>{att.length}{members.length ? ` of ${members.length}` : ''}</b>
          </div>
          <div className="control" style={{ marginTop: 0 }}>
            <input className="input" style={{ paddingLeft: 50 }} placeholder="Search name or roll no." aria-label="Search attendance" value={q} onChange={(e) => setQ(e.target.value)} />
            <Ic n="search" style={{ position: 'absolute', left: 16, top: 18, color: 'var(--ink-soft)' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            {attRows.length === 0 ? <EmptyState title={att.length ? 'No one matches.' : 'No one has checked in yet.'} /> :
              attRows.slice(0, 200).map((a) => {
                const m = byId.get(a.member_id);
                return (
                  <div className="member" key={a.member_id}>
                    <Avatar name={m?.name ?? '?'} path={m?.photo_path} />
                    <span className="grow">
                      <span className="member__n">{m?.name ?? 'Former member'}</span>
                      <span className="member__s" style={{ display: 'block' }}>{m?.roll_number ?? ''}{m ? ' · ' : ''}{fmtTime(a.checked_in_at)} · {METHOD[a.method]}</span>
                    </span>
                    <button className="smallbtn" style={{ background: 'var(--paper-deep)' }} aria-label={`Remove ${m?.name ?? 'check-in'}`} onClick={() => setRemoving(a)}><Ic n="x" /></button>
                  </div>
                );
              })}
          </div>
          {att.length > 0 && <Btn tone="line" block style={{ marginTop: 12 }} onClick={exportCsv}><Ic n="dl" />Export CSV</Btn>}
        </div>

        {/* ---------- mark present ---------- */}
        <div className="sec">
          <div className="sec__head"><h2 className="h3">Mark someone present</h2></div>
          <div className="control" style={{ marginTop: 0 }}>
            <input className="input" style={{ paddingLeft: 50 }} placeholder="Search your members" aria-label="Search members to mark present" value={pq} onChange={(e) => setPq(e.target.value)} />
            <Ic n="search" style={{ position: 'absolute', left: 16, top: 18, color: 'var(--ink-soft)' }} />
          </div>
          {pq.trim() && candidates.length === 0 && <p className="small muted" style={{ marginTop: 10 }}>No one left to mark with that search.</p>}
          <div style={{ marginTop: 10 }}>
            {candidates.map((m) => (
              <div className="member" key={m.id}>
                <Avatar name={m.name} path={m.photo_path} />
                <span className="grow"><span className="member__n">{m.name}</span><span className="member__s" style={{ display: 'block' }}>{m.roll_number}</span></span>
                <Btn tone="mint" size="sm" disabled={busy} onClick={() => void markPresent(m)}>Mark present</Btn>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- not yet checked in ---------- */}
        <div className="sec">
          <button className="item" style={{ alignItems: 'center' }} aria-expanded={showMissing} onClick={() => setShowMissing((s) => !s)}>
            <span className="item__ic item__ic--sun"><Ic n="users" /></span>
            <span className="grow"><span className="item__t">Not yet checked in</span><span className="small muted" style={{ display: 'block' }}>{missing.length} member{missing.length === 1 ? '' : 's'}</span></span>
            <Ic n="chev" style={{ rotate: showMissing ? '90deg' : '0deg' }} />
          </button>
          {showMissing && (
            <div style={{ marginTop: 10 }}>
              {missing.length === 0 ? <EmptyState title="Everyone is in." /> : missing.slice(0, 200).map((m) => {
                const wa = waLink(m.phone, `Hi ${m.name.split(' ')[0]}, we're starting "${ev.title}" at ${fmtTime(ev.starts_at)}${ev.venue ? ` in ${ev.venue}` : ''}. Hope to see you there! `);
                return (
                  <div className="member" key={m.id}>
                    <Avatar name={m.name} path={m.photo_path} />
                    <span className="grow"><span className="member__n">{m.name}</span><span className="member__s" style={{ display: 'block' }}>{m.roll_number}</span></span>
                    {wa && <a className="smallbtn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${m.name}`}><Ic n="chat" /></a>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- danger zone ---------- */}
        <div className="sec stack">
          {ev.cancelled
            ? <Btn tone="white" block onClick={() => void setCancelled(false)} loading={busy}>Restore this event</Btn>
            : <Btn tone="white" block onClick={() => setCancelAsk(true)}>Cancel this event</Btn>}
          <Btn tone="line" block onClick={() => setDeleteAsk(true)}>Delete event</Btn>
        </div>
      </div>

      {screen && code && <CodeScreen code={code} qr={qr} title={ev.title} onClose={() => setScreen(false)} />}

      <ConfirmSheet open={!!removing} title={`Remove ${removing ? (byId.get(removing.member_id)?.name ?? 'this check-in') : ''}?`} text="They will no longer count as present."
        confirmLabel="Remove" danger busy={busy} onConfirm={removeAtt} onCancel={() => setRemoving(null)} />
      <ConfirmSheet open={regen} title="Create a new code?" text="Members who haven't checked in yet will need the new code. The old one stops working."
        confirmLabel="New code" busy={busy} onConfirm={regenerate} onCancel={() => setRegen(false)} />
      <ConfirmSheet open={cancelAsk} title="Cancel this event?" text="Members will see it as cancelled and can't check in. You can restore it later."
        confirmLabel="Cancel event" danger busy={busy} onConfirm={() => void setCancelled(true)} onCancel={() => setCancelAsk(false)} />
      <ConfirmSheet open={deleteAsk} title="Delete this event?" text={`${att.length} check-in${att.length === 1 ? '' : 's'} will be deleted with it. This can't be undone.`}
        confirmLabel="Delete" danger busy={busy} onConfirm={deleteEvent} onCancel={() => setDeleteAsk(false)} />
      <ConfirmSheet open={!!announceAsk} title="Tell your members?" text="Post a short announcement about the cancellation. We'll fill it in for you."
        confirmLabel="Write announcement" cancelLabel="Not now"
        onConfirm={() => {
          const t = announceAsk ?? ev.title; setAnnounceAsk(null);
          nav(`${P.announce}?new=1&title=${encodeURIComponent(`Cancelled: ${t}`.slice(0, 120))}&body=${encodeURIComponent(`"${t}" on ${fmtDateTime(ev.starts_at)} has been cancelled. We'll share a new date soon.`)}`);
        }}
        onCancel={() => setAnnounceAsk(null)} />
    </section>
  );
}
