/**
 * src/pages/member/IdCard.tsx   (route /app/id, inside MemberGuard + AppShell)
 * The digital ID. The QR is just a link to /verify/<public_id>, generated locally so it works offline.
 * A live clock and a shimmer show it is a live screen, not a screenshot.
 */
import { useEffect, useRef, useState } from 'react';
import { useReadyMember } from '../../contexts/MemberContext';
import { useQr } from '../../hooks/useQr';
import { formatMemberNo, verifyUrl } from '../../lib/idcard';
import { fmtClock } from '../../lib/format';
import ConfirmSheet from '../../components/member/ConfirmSheet';
import { Avatar, BackBar, Btn, Chip, FixedPortal, Ic, Note, useOnline, useToast } from '../../components/member/ui';

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    let id: number | undefined;
    const start = () => { stop(); id = window.setInterval(() => setT(new Date()), 1000); };
    const stop = () => { if (id) window.clearInterval(id); id = undefined; };
    const vis = () => (document.visibilityState === 'visible' ? (setT(new Date()), start()) : stop());
    start();
    document.addEventListener('visibilitychange', vis);
    return () => { stop(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return t;
}

/** Full-screen white QR: for scanners that struggle with dim phones. */
function BigQr({ qr, name, line, onClose }: { qr: string | null; name: string; line: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch { /* not supported or denied */ }
    };
    void ask();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const vis = () => { if (document.visibilityState === 'visible') void ask(); };
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', vis);
      void lock?.release().catch(() => {});
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <FixedPortal>
      <div className="ov ov--white" role="dialog" aria-modal="true" aria-label="ID QR code" onClick={onClose}>
        <div className="ov__col">
          <button ref={closeRef} className="close" aria-label="Close" onClick={onClose}><Ic n="x" /></button>
          <div className="qrbig">{qr && <img className="qrimg" src={qr} alt="QR code for your Sambhav ID" />}</div>
          <div>
            <h2 className="h2" style={{ margin: 0 }}>{name}</h2>
            <p className="muted" style={{ fontWeight: 700, marginTop: 4 }}>{line}</p>
          </div>
          <p className="small muted">Screen brightness is up. Tap anywhere to close.</p>
        </div>
      </div>
    </FixedPortal>
  );
}

export default function IdCard() {
  const { member, refresh } = useReadyMember();
  const online = useOnline();
  const toast = useToast();
  const now = useClock();
  const [big, setBig] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);

  const url = verifyUrl(member.public_id);
  const qr = useQr(url, 600);
  const approved = member.status === 'approved';
  const roleLabel = member.role === 'lead' ? 'Lead' : member.role === 'colead' ? 'Co-lead' : 'Member';
  const since = member.joined_at ? new Date(member.joined_at).getFullYear() : null;
  const line = `${member.domain_name ?? 'Sambhav'} · ${formatMemberNo(member.member_no)}`;

  // refresh on open; if an admin regenerated the ID, tell the member
  const lastId = useRef(member.public_id);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (lastId.current !== member.public_id) { lastId.current = member.public_id; toast('Your ID was updated'); }
  }, [member.public_id, toast]);

  const share = async () => {
    setConfirmShare(false);
    const data = { title: 'My Sambhav ID', text: `${member.name} · Sambhav 4.0`, url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    copy();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { toast("Couldn't copy the link"); }
  };

  return (
    <section className="screen">
      <BackBar to="/app" label="Home" />
      <div className="pad" style={{ marginTop: 6 }}>
        <p className="eyebrow">Digital ID</p>
        <h1 className="h2">My member ID</h1>
      </div>

      <div className="idwrap" style={{ marginTop: 18 }}>
        <article
          className={`idc${approved ? '' : ' idc--pending'}`}
          role="img"
          aria-label={`Member ID: ${member.name}, ${member.domain_name ?? 'no domain'}, ${approved ? (online ? 'valid' : 'valid, offline') : 'pending approval'}`}
        >
          <div className="idc__top">
            <i className="bd bd--a" /><i className="bd bd--b" />
            <div className="idc__brand">
              <span className="brand">
                <svg viewBox="0 0 32 32" aria-hidden="true"><use href="#venn" /></svg>Sambhav 4.0
              </span>
              <span className="idc__role">{roleLabel}</span>
            </div>
          </div>
          <Avatar name={member.name} path={member.photo_path} className="idc__photo" />
          <div className="idc__body">
            <h2 className="idc__name">{member.name}</h2>
            <div className="idc__chips">
              {member.domain_name && <Chip tone="blue">{member.domain_name}</Chip>}
              {since && <Chip tone="deep">Member since {since}</Chip>}
            </div>
            <div className="idc__nums">
              <div><small>Roll no.</small><b>{member.roll_number}</b></div>
              <div><small>Member no.</small><b>{formatMemberNo(member.member_no)}</b></div>
            </div>
            {approved && (
              <div className="idc__qr">{qr ? <img className="qrimg" src={qr} alt="QR code for your Sambhav ID" /> : <div className="skel" style={{ aspectRatio: '1' }} />}</div>
            )}
            {!approved ? (
              <div className="idc__valid idc__valid--pending">Pending approval</div>
            ) : online ? (
              <div className="idc__valid">
                <Ic n="check" />Valid
                <span className="live"><i /><span>{fmtClock(now)} IST</span></span>
              </div>
            ) : (
              <div className="idc__valid idc__valid--off"><Ic n="alert" />Offline · status not live</div>
            )}
          </div>
        </article>
      </div>

      <div className="idactions">
        {approved && <Btn tone="blue" onClick={() => setBig(true)}><Ic n="sun" />Show QR big</Btn>}
        <Btn tone="line" onClick={() => setConfirmShare(true)}><Ic n="share" />Share</Btn>
        <Btn tone="white" onClick={copy}><Ic n="copy" />Copy link</Btn>
      </div>

      <div className="pad">
        <Note style={{ marginTop: 20 }}>
          Show this at the venue. A volunteer scans the QR and sees only your name, domain and status. Your roll number, email and phone are never shown on the scan page.
        </Note>
      </div>

      {big && <BigQr qr={qr} name={member.name} line={line} onClose={() => setBig(false)} />}
      <ConfirmSheet
        open={confirmShare} title="Share your ID link?"
        text="Anyone with this link can see that you're a valid member, with your name and domain. They can't see your roll number, email or phone."
        confirmLabel="Share" onConfirm={share} onCancel={() => setConfirmShare(false)}
      />
    </section>
  );
}
