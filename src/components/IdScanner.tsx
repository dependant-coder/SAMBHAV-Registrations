/**
 * src/components/IdScanner.tsx
 * Shared by /app/scan (leads, scope="lead") and /admin/scan (super admin, scope="admin").
 * Reads the QR on a member's ID, then either verifies only or checks the member in to an event.
 *
 * Needs:  npm i qr-scanner
 * Rules:  the scanned URL is NEVER opened or fetched. We only extract an 18-hex id from it.
 *         Network failure never shows green. The same QR is ignored for 3 s (debounce).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { supabase } from '../lib/supabase';
import { useMember } from '../contexts/MemberContext';
import { formatMemberNo, parseMemberNo, parseScanned } from '../lib/idcard';
import { EVENT_COLS, norm } from '../lib/events';
import type { EventRow } from '../lib/events';
import { fmtTime, timeAgo } from '../lib/format';
import { AppFrame, Btn, FixedPortal, Ic, Note, usePhotoUrl } from './member/ui';
import ConfirmSheet from './member/ConfirmSheet';

type Kind = 'ok' | 'verified' | 'already' | 'inactive' | 'not_eligible' | 'invalid' | 'cancelled' | 'forbidden' | 'offline';
type Overlay = { kind: Kind; name?: string; line?: string; photoPath?: string | null; id: number };
type Recent = { memberId: string; name: string; at: number };

const NO_EVENT = '__verify__';

const TITLES: Record<Kind, [string, string]> = {
  ok: ['Checked in', ''],
  verified: ['Valid member', ''],
  already: ['Already', 'checked in'],
  inactive: ['Not an active', 'member'],
  not_eligible: ["Not in this", "event's domain"],
  invalid: ['ID not found', ''],
  cancelled: ['Event', 'cancelled'],
  forbidden: ["You can't check in", 'to this event'],
  offline: ['No connection', ''],
};
const TONE: Record<Kind, string> = {
  ok: 'sr--ok', verified: 'sr--ok', already: 'sr--already', inactive: 'sr--warn', not_eligible: 'sr--warn',
  invalid: 'sr--bad', cancelled: 'sr--bad', forbidden: 'sr--bad', offline: 'sr--bad',
};
const SUB: Partial<Record<Kind, string>> = {
  invalid: "That isn't a Sambhav ID", offline: 'Not recorded. Try again', cancelled: 'Nothing was recorded',
  forbidden: 'Nothing was recorded', inactive: 'Nothing was recorded. Tap to continue', not_eligible: 'Nothing was recorded. Tap to continue',
};

function ResultOverlay({ o, onClose }: { o: Overlay; onClose: () => void }) {
  const photo = usePhotoUrl(o.photoPath);
  useEffect(() => { const t = setTimeout(onClose, 1800); return () => clearTimeout(t); }, [o.id, onClose]);
  const [a, b] = TITLES[o.kind];
  return (
    <FixedPortal>
      <div className="scanres" role="status" aria-live="assertive" onClick={onClose}>
        <div className={TONE[o.kind]} style={{ position: 'absolute', inset: 0 }}>
          <div className="col">
            <span className="mark"><Ic n={o.kind === 'ok' || o.kind === 'verified' || o.kind === 'already' ? 'check' : o.kind === 'invalid' ? 'x' : 'alert'} /></span>
            <h2>{a}{b && <><br />{b}</>}</h2>
            {o.name && <p className="nm">{o.name}</p>}
            {o.line && <span className="chip chip--ink">{o.line}</span>}
            {photo && <span className="ph"><img src={photo} alt="" /></span>}
            <p className="tap">{SUB[o.kind] ?? 'Tap to keep scanning'}</p>
          </div>
        </div>
      </div>
    </FixedPortal>
  );
}

export default function IdScanner({ scope }: { scope: 'lead' | 'admin' }) {
  const { roles } = useMember();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const backTo = scope === 'admin' ? '/admin' : '/app/lead';

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastSeen = useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const busyRef = useRef(false);
  const eventRef = useRef<string>(NO_EVENT);
  const overlayId = useRef(0);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string>(sp.get('event') ?? NO_EVENT);
  const [camState, setCamState] = useState<'idle' | 'starting' | 'on' | 'denied' | 'none' | 'insecure'>('idle');
  const [flash, setFlash] = useState<{ has: boolean; on: boolean }>({ has: false, on: false });
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [undo, setUndo] = useState<Recent | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [revoked, setRevoked] = useState(false);

  eventRef.current = eventId;
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  /* ---------- events the person may check in to ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const from = new Date(Date.now() - 24 * 3600_000).toISOString();
      const to = new Date(Date.now() + 36 * 3600_000).toISOString();
      const { data } = await supabase.from('events').select(EVENT_COLS).gte('starts_at', from).lte('starts_at', to).eq('cancelled', false).order('starts_at');
      if (!alive) return;
      let list = ((data ?? []) as unknown as EventRow[]).map(norm);
      if (scope === 'lead') {
        const mine = new Set(roles.map((r) => r.domain_id));
        list = list.filter((e) => e.audience === 'domain' && e.domain_id && mine.has(e.domain_id));   // leads: own-domain events only
      }
      setEvents(list);
      setEventId((cur) => {
        if (cur !== NO_EVENT && list.some((e) => e.id === cur)) return cur;
        const nearest = list.find((e) => Math.abs(new Date(e.starts_at).getTime() - Date.now()) < 6 * 3600_000) ?? list[0];
        return nearest?.id ?? NO_EVENT;
      });
    })();
    return () => { alive = false; };
  }, [scope, roles]);

  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (eventId === NO_EVENT) next.delete('event'); else next.set('event', eventId);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [eventId, sp, setSp]);

  /* ---------- counter ---------- */
  const loadCount = useCallback(async () => {
    if (eventId === NO_EVENT) { setCount(null); return; }
    const { count: c, error } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
    if (!error) setCount(c ?? 0);
  }, [eventId]);
  useEffect(() => { setRecent([]); void loadCount(); }, [loadCount]);

  /* ---------- results ---------- */
  const show = useCallback((o: Omit<Overlay, 'id'>) => {
    setOverlay({ ...o, id: ++overlayId.current });
    if (o.kind === 'ok' || o.kind === 'verified') navigator.vibrate?.(80);
  }, []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  const handleRef = useCallback(async (ref: string, source: 'camera' | 'manual') => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (!navigator.onLine) { show({ kind: 'offline' }); return; }
      const ev = eventRef.current;

      if (ev === NO_EVENT) {
        if (source === 'manual') return;     // manual entry is only meaningful for check-in
        const { data, error } = await supabase.rpc('verify_member', { p_public_id: ref });
        if (error) { show({ kind: 'offline' }); return; }
        const r = data as { result: string; name?: string; domain_name?: string; member_no?: number; photo_path?: string | null };
        if (r.result === 'valid') show({ kind: 'verified', name: r.name, line: `${r.domain_name ?? 'Sambhav'} · ${formatMemberNo(r.member_no)}`, photoPath: r.photo_path });
        else if (r.result === 'inactive') show({ kind: 'inactive', name: r.name });
        else show({ kind: 'invalid' });
        return;
      }

      const { data, error } = await supabase.rpc('scan_check_in', { p_event: ev, p_ref: ref });
      if (error) { show({ kind: 'offline' }); return; }          // never green on a failure
      const r = data as { result: string; name?: string; member_id?: string };
      switch (r.result) {
        case 'ok': {
          show({ kind: 'ok', name: r.name });
          if (r.member_id) setRecent((cur) => [{ memberId: r.member_id!, name: r.name ?? 'Member', at: Date.now() }, ...cur].slice(0, 10));
          void loadCount();
          // best effort: add domain/number/photo (photo only comes back for admins and own-domain leads)
          if (/^[0-9a-f]{18}$/.test(ref)) {
            void supabase.rpc('verify_member', { p_public_id: ref }).then(({ data: v }) => {
              const x = v as { domain_name?: string; member_no?: number; photo_path?: string | null } | null;
              if (x) setOverlay((cur) => (cur && cur.kind === 'ok' && cur.name === r.name
                ? { ...cur, line: `${x.domain_name ?? 'Sambhav'} · ${formatMemberNo(x.member_no)}`, photoPath: x.photo_path } : cur));
            });
          }
          return;
        }
        case 'already': show({ kind: 'already', name: r.name }); return;
        case 'inactive': show({ kind: 'inactive', name: r.name }); return;
        case 'not_eligible': show({ kind: 'not_eligible', name: r.name }); return;
        case 'cancelled': show({ kind: 'cancelled' }); return;
        case 'forbidden': setRevoked(true); show({ kind: 'forbidden' }); return;
        default: show({ kind: 'invalid' });
      }
    } finally {
      busyRef.current = false;
    }
  }, [show, loadCount]);

  /* ---------- camera ---------- */
  const stopCamera = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
    setFlash({ has: false, on: false });
    setCamState((s) => (s === 'on' || s === 'starting' ? 'idle' : s));
  }, []);

  const startCamera = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCamState('insecure'); return; }
    if (!(await QrScanner.hasCamera())) { setCamState('none'); return; }
    if (!videoRef.current) return;
    setCamState('starting');
    try {
      scannerRef.current?.destroy();
      const sc = new QrScanner(
        videoRef.current,
        (r) => {
          const text = typeof r === 'string' ? r : r.data;
          const id = parseScanned(text);
          const t = Date.now();
          const key = id ?? `x:${text.slice(0, 40)}`;
          if (lastSeen.current.id === key && t - lastSeen.current.at < 3000) return;   // debounce
          lastSeen.current = { id: key, at: t };
          if (!id) { show({ kind: 'invalid' }); return; }                          // not ours: never open/fetch it
          void handleRef(id, 'camera');
        },
        { preferredCamera: 'environment', returnDetailedScanResult: true, highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 5 },
      );
      scannerRef.current = sc;
      await sc.start();
      setCamState('on');
      setFlash({ has: await sc.hasFlash().catch(() => false), on: false });
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        wake.current = (await nav.wakeLock?.request('screen')) ?? null;
      } catch { /* optional */ }
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      setCamState(/denied|permission|notallowed/i.test(m) ? 'denied' : /no camera/i.test(m) ? 'none' : 'denied');
    }
  }, [handleRef, show]);

  // release the camera when the tab is hidden and when leaving the page
  useEffect(() => {
    const vis = () => { if (document.visibilityState === 'hidden') stopCamera(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); stopCamera(); };
  }, [stopCamera]);

  const toggleFlash = async () => {
    const sc = scannerRef.current; if (!sc) return;
    try { await sc.toggleFlash(); setFlash((f) => ({ ...f, on: sc.isFlashOn() })); } catch { /* ignore */ }
  };

  /* ---------- manual entry + undo ---------- */
  const submitManual = async () => {
    const n = parseMemberNo(manual);
    if (!n) return;
    setManualBusy(true);
    await handleRef(n, 'manual');
    setManualBusy(false);
    setManual('');
  };

  const doUndo = async () => {
    if (!undo || eventId === NO_EVENT) return;
    setUndoBusy(true);
    const { error } = await supabase.from('attendance').delete().eq('event_id', eventId).eq('member_id', undo.memberId);
    setUndoBusy(false);
    if (!error) { setRecent((cur) => cur.filter((r) => r.memberId !== undo.memberId)); void loadCount(); }
    setUndo(null);
  };

  const selected = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  if (revoked && scope === 'lead') {
    return (
      <AppFrame dark>
        <section className="screen scan screen--bare">
          <div className="pad" style={{ paddingTop: 40 }}>
            <Note tone="warn">You no longer have access to this scanner.</Note>
            <Btn tone="sun" block style={{ marginTop: 16 }} onClick={() => nav('/app', { replace: true })}>Back to the app</Btn>
          </div>
        </section>
      </AppFrame>
    );
  }

  return (
    <AppFrame dark>
      <section className="screen scan screen--bare">
        <div className="topnav" style={{ paddingBottom: 8 }}>
          <button className="back" onClick={() => nav(backTo)}><Ic n="back" />Back</button>
          <span className="eyebrow" style={{ color: 'var(--sun)', marginLeft: 'auto' }}>Scan IDs</span>
        </div>

        <div className="selwrap">
          <select aria-label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {fmtTime(e.starts_at)}</option>)}
            <option value={NO_EVENT}>Verify only (no check-in)</option>
          </select>
        </div>

        <div className="cam" aria-label="Camera preview">
          <video ref={videoRef} playsInline muted />
          {camState === 'on' && (
            <>
              <div className="frame"><i /><i /><i /><i /></div>
              <div className="line" />
              {flash.has && (
                <div className="tools"><button aria-label="Torch" aria-pressed={flash.on} onClick={toggleFlash}><Ic n="flash" /></button></div>
              )}
              <div className="hintbar">Point at the QR on the member's phone</div>
            </>
          )}
          {camState !== 'on' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', gap: 12, alignContent: 'center' }}>
              {camState === 'denied' && <p className="small">Camera access is blocked. Allow the camera in your browser's site settings, or use manual entry below.</p>}
              {camState === 'none' && <p className="small">No camera found. Use manual entry below.</p>}
              {camState === 'insecure' && <p className="small">The camera needs a secure (https) connection. Use manual entry below.</p>}
              {(camState === 'idle' || camState === 'starting' || camState === 'denied') && (
                <Btn tone="sun" loading={camState === 'starting'} onClick={() => void startCamera()}><Ic n="scan" />{camState === 'denied' ? 'Try again' : 'Start scanning'}</Btn>
              )}
            </div>
          )}
        </div>
        {camState === 'on' && <p className="tiny" style={{ margin: '8px var(--gutter) 0', opacity: 0.75 }}>Low light? Turn the member's screen brightness up.</p>}

        {selected && count !== null && (
          <div className="counter-big"><b>{count}</b><span style={{ fontWeight: 700, opacity: 0.85 }}>checked in to this event</span></div>
        )}
        {eventId === NO_EVENT && (
          <p className="small" style={{ margin: '16px var(--gutter) 0', opacity: 0.85 }}>
            Verify-only mode: scans show who the member is but record nothing. Pick an event above to check people in.
          </p>
        )}

        {recent.length > 0 && (
          <div className="recent">
            <p className="eyebrow" style={{ color: 'var(--sun)' }}>Recent scans</p>
            {recent.map((r) => (
              <div className="r" key={`${r.memberId}-${r.at}`}>
                <i><Ic n="check" /></i><span>{r.name}</span><small>{timeAgo(new Date(r.at).toISOString(), now)}</small>
                <button onClick={() => setUndo(r)}>Undo</button>
              </div>
            ))}
          </div>
        )}

        <div className="manual">
          <b>No camera? Enter the member number</b>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void submitManual(); }}>
            <input
              className="input" style={{ paddingRight: 18 }} placeholder="e.g. 42 or SMB4-0042" aria-label="Member number"
              inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} disabled={eventId === NO_EVENT}
            />
            <Btn tone="sun" type="submit" style={{ minHeight: 50, padding: '0 18px' }} loading={manualBusy} disabled={eventId === NO_EVENT || !parseMemberNo(manual)}>Check in</Btn>
          </form>
          {eventId === NO_EVENT && <p className="tiny" style={{ marginTop: 8, opacity: 0.75 }}>Pick an event to check people in.</p>}
        </div>

        {overlay && <ResultOverlay o={overlay} onClose={closeOverlay} />}
        <ConfirmSheet
          open={!!undo} title={`Remove ${undo?.name ?? 'this check-in'}?`} text="They will no longer count as present for this event."
          confirmLabel="Remove check-in" danger busy={undoBusy} onConfirm={doUndo} onCancel={() => setUndo(null)}
        />
      </section>
    </AppFrame>
  );
}
