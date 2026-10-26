/**
 * src/pages/public/VerifyMember.tsx   (route /verify/:publicId, PUBLIC: outside every guard and AppShell)
 * What a volunteer sees after scanning a card with any camera. Always asks the server, never shows a cached answer.
 * Anonymous viewers get name, domain, role, member no. and "since". Photo only for super admins and the member's own lead.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useMember } from '../../contexts/MemberContext';
import { fmtDateTime, initialsOf } from '../../lib/format';
import { formatMemberNo, isPublicId } from '../../lib/idcard';
import { AppFrame, Btn, Chip, Ic, Note } from '../../components/member/ui';

type Verify = {
  result: 'valid' | 'inactive' | 'invalid';
  name?: string; domain_name?: string | null; role?: 'lead' | 'colead' | null;
  member_no?: number; member_since?: number; photo_path?: string | null;
};

const withTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
  Promise.race([Promise.resolve(p), new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

function Inner() {
  const { publicId = '' } = useParams();
  const { roles, state } = useMember();
  const [res, setRes] = useState<Verify | null>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [photo, setPhoto] = useState<string | null>(null);

  // never indexed
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);

  const run = useCallback(async () => {
    setPhoto(null);
    if (!isPublicId(publicId)) { setRes({ result: 'invalid' }); setStatus('done'); setCheckedAt(new Date()); return; }   // no request
    setStatus('loading');
    try {
      const { data, error } = await withTimeout(supabase.rpc('verify_member', { p_public_id: publicId }), 10_000);
      if (error) throw error;
      setRes(data as Verify); setCheckedAt(new Date()); setStatus('done');
      const path = (data as Verify | null)?.photo_path;
      if (path) {
        const s = await supabase.storage.from('member-photos').createSignedUrl(path, 60);
        if (s.data?.signedUrl) setPhoto(s.data.signedUrl);
      }
    } catch {
      setRes(null); setStatus('error');     // NEVER fall back to a green screen
    }
  }, [publicId]);

  useEffect(() => { void run(); }, [run]);

  const staff = !!res?.photo_path;
  const scanHref = state.kind === 'ready' && roles.length > 0 ? '/app/scan' : '/admin/scan';
  const kind = res?.result;
  const roleLabel = res?.role === 'lead' ? 'Lead' : res?.role === 'colead' ? 'Co-lead' : 'Member';

  const big =
    kind === 'valid' ? { cls: 'vbig--valid', icon: 'check' as const, text: ['VALID', 'MEMBER'] }
      : kind === 'inactive' ? { cls: 'vbig--inactive', icon: 'alert' as const, text: ['NOT', 'ACTIVE'] }
        : kind === 'invalid' ? { cls: 'vbig--bad', icon: 'x' as const, text: ['NOT', 'FOUND'] }
          : status === 'error' ? { cls: 'vbig--inactive', icon: 'alert' as const, text: ["CAN'T", 'VERIFY'] }
            : null;

  return (
    <section className="screen screen--bare">
      <div className={`vbig ${big?.cls ?? 'vbig--inactive'}`} role="status" aria-live="polite">
        <a className="brand" href="/" style={{ marginBottom: 8 }}>
          <svg viewBox="0 0 32 32" aria-hidden="true"><use href="#venn" /></svg>Sambhav 4.0
        </a>
        {status === 'loading' || !big ? (
          <>
            <span className="mark" style={{ background: 'var(--ink)', color: 'var(--paper)' }}><span className="spin" /></span>
            <h1>CHECKING…</h1>
          </>
        ) : (
          <>
            <span className="mark"><Ic n={big.icon} /></span>
            <h1>{big.text[0]}<br />{big.text[1]}</h1>
          </>
        )}
      </div>

      {status === 'error' && (
        <div className="pad stack" style={{ marginTop: 22 }}>
          <Note tone="warn">Can't verify right now (no connection or the server is slow). Nothing is shown from memory. Try again.</Note>
        </div>
      )}

      {status === 'done' && kind === 'invalid' && (
        <div className="pad">
          <Note tone="err" style={{ marginTop: 22 }}>
            This ID isn't recognised. It may be old, mistyped or not a Sambhav ID. Ask the member to open <strong>My ID</strong> in the app.
          </Note>
        </div>
      )}

      {status === 'done' && (kind === 'valid' || kind === 'inactive') && res && (
        <div className="vcard">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            {staff && (
              <span className="vphoto">
                {photo ? <img src={photo} alt={`Photo of ${res.name ?? 'member'}`} /> : <span className="initials" aria-hidden="true">{initialsOf(res.name ?? '')}</span>}
              </span>
            )}
            <div className="grow">
              <h2 className="h3" style={{ fontSize: 25, letterSpacing: '-.035em' }}>{res.name}</h2>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {res.domain_name && <Chip tone="blue">{res.domain_name}</Chip>}
                <Chip tone="deep">{roleLabel}</Chip>
              </div>
            </div>
          </div>
          <dl className="kv">
            <dt>Member no.</dt><dd>{formatMemberNo(res.member_no)}</dd>
            {res.member_since ? (<><dt>Member since</dt><dd>{res.member_since}</dd></>) : null}
            <dt>Checked</dt><dd>{fmtDateTime(checkedAt)}</dd>
          </dl>
          {staff
            ? <Note style={{ marginTop: 14 }}>You can see the photo because you're a lead or admin. Match it to the person in front of you.</Note>
            : <p className="tiny muted" style={{ marginTop: 14 }}>Roll number, email and phone are never shown on this page.</p>}
        </div>
      )}

      <div className="pad stack" style={{ marginTop: 18 }}>
        <Btn tone="ink" block onClick={() => void run()} loading={status === 'loading'}><Ic n="scan" />Check again</Btn>
        {staff && <Link className="btn btn--blue btn--block" to={scanHref}><Ic n="scan" />Open scanner</Link>}
        <p className="tiny muted" style={{ textAlign: 'center' }}>Never shows a saved result. Always checked live with the server.</p>
      </div>
    </section>
  );
}

export default function VerifyMember() {
  return <AppFrame><Inner /></AppFrame>;
}
