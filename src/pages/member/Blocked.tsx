/**
 * src/pages/member/Blocked.tsx
 * BlockedScreen (signed in, but no usable member) and PendingScreen (registered, not approved yet).
 * Both render inside <AppFrame> from MemberGuard.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMember } from '../../contexts/MemberContext';
import type { BlockedReason } from '../../contexts/MemberContext';
import { Band, Btn, Ic, MemberFoot, Note, useToast, Avatar } from '../../components/member/ui';

const COPY: Record<BlockedReason, { title: string; body: (email: string) => React.ReactNode }> = {
  not_found: {
    title: "We couldn't find\nyour registration.",
    body: (e) => (
      <>No member is registered with <strong>{e || 'this email'}</strong>. Sign in with the Google account you <strong>registered with</strong>, or use your roll number + PIN.</>
    ),
  },
  ambiguous: {
    title: 'Two members share\nthis email.',
    body: () => <>More than one member uses this email. Please contact the core team so they can fix it.</>,
  },
  already_linked: {
    title: 'Already linked to\nanother login.',
    body: () => <>This registration is already connected to a different login. Contact the core team to reset it.</>,
  },
  unverified: {
    title: 'Verify your\nemail first.',
    body: () => <>Your email isn't verified. Sign in with Google instead.</>,
  },
  error: {
    title: 'Something went\nwrong.',
    body: () => <>We couldn't load your account. Check your internet and try again.</>,
  },
};

export function BlockedScreen() {
  const { state, refresh, signOut } = useMember();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  if (state.kind !== 'blocked') return null;
  const c = COPY[state.reason];

  const out = async () => { setBusy(true); await signOut(); nav('/app/login', { replace: true }); };

  return (
    <section className="screen screen--bare">
      <Band
        tone="sun" pb={46}
        eyebrow={state.email ? `Signed in as ${state.email}` : 'Members app'}
        title={c.title.split('\n').map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}
        titleStyle={{ fontSize: 'clamp(30px,9.5cqw,40px)' }}
      />
      <div className="pad stack" style={{ marginTop: 20 }}>
        <Note tone="warn">{c.body(state.email ?? '')}</Note>

        {state.reason === 'error' && <Btn tone="blue" block onClick={() => void refresh()}>Try again</Btn>}
        {state.reason === 'not_found' && (
          <>
            <Link className="btn btn--blue btn--block" to="/">Register now</Link>
            <Btn tone="line" block onClick={out}>Use roll number + PIN</Btn>
          </>
        )}
        {state.isAdmin && <Link className="btn btn--white btn--block" to="/admin">Go to admin panel</Link>}
        <Btn tone="white" block loading={busy} onClick={out}><Ic n="out" />Sign out</Btn>
      </div>
      <MemberFoot credit={false} />
    </section>
  );
}

export function PendingScreen() {
  const { member, refresh, signOut } = useMember();
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!member) return null;
  const first = member.name.trim().split(/\s+/)[0] || 'there';

  const check = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
    toast("Still pending. We'll notify you once approved.");
  };

  return (
    <section className="screen screen--bare">
      <Band
        tone="mint" pb={46}
        eyebrow="Almost there"
        title={<>Hi {first}, we're<br />reviewing you.</>}
        titleStyle={{ fontSize: 'clamp(32px,10cqw,42px)' }}
        right={<Avatar name={member.name} path={member.photo_path} />}
      />
      <div className="pad stack" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="row">
            <span className="item__ic item__ic--sun"><Ic n="clock" /></span>
            <span className="grow">
              <span className="h3" style={{ display: 'block' }}>Waiting for approval</span>
              <span className="small muted">The core team approves new members, usually within a day.</span>
            </span>
          </div>
          <hr className="hr" />
          <dl className="kv" style={{ marginTop: 0 }}>
            <dt>Name</dt><dd>{member.name}</dd>
            <dt>Roll number</dt><dd>{member.roll_number}</dd>
            <dt>Domain</dt><dd>{member.domain_name ?? '—'}</dd>
          </dl>
        </div>
        <Btn tone="ink" block loading={busy} onClick={check}>Refresh status</Btn>
        <Btn tone="white" block onClick={async () => { await signOut(); nav('/app/login', { replace: true }); }}>
          <Ic n="out" />Sign out
        </Btn>
      </div>
      <MemberFoot credit={false} />
    </section>
  );
}
