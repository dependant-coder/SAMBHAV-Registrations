/**
 * src/pages/member/AuthCallback.tsx   (route /auth/callback, PUBLIC: not inside MemberGuard)
 * supabase-js reads the ?code= from the URL by itself. We just wait for the member state and move on.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMember } from '../../contexts/MemberContext';
import { takeFrom } from '../../lib/nav';
import { AppFrame, Band, Btn, Note, Splash } from '../../components/member/ui';

/** Plain-text only, short, never trusted as HTML */
function readUrlError(): string | null {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const raw = q.get('error_description') ?? h.get('error_description') ?? q.get('error') ?? h.get('error');
  if (!raw) return null;
  if (/access_denied/i.test(raw)) return 'Sign-in was cancelled. Nothing was changed.';
  return raw.replace(/\+/g, ' ').replace(/[<>]/g, '').slice(0, 160);
}

function Inner() {
  const { state } = useMember();
  const nav = useNavigate();
  const [urlError] = useState(readUrlError);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (urlError) return;
    // member state leaves "loading" once the code exchange has produced a session (or failed)
    if (state.kind === 'ready' || state.kind === 'blocked') nav(takeFrom(), { replace: true });
  }, [state.kind, urlError, nav]);

  useEffect(() => {
    if (urlError) return;
    const t = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(t);
  }, [urlError]);

  if (urlError || (state.kind === 'signed_out' && slow)) {
    return (
      <section className="screen screen--bare">
        <Band tone="sun" pb={46} eyebrow="Members app" title={<>Couldn't sign<br />you in.</>} titleStyle={{ fontSize: 'clamp(32px,10cqw,42px)' }} />
        <div className="pad stack" style={{ marginTop: 20 }}>
          <Note tone="warn">{urlError ?? 'Sign-in did not finish. Please try again.'}</Note>
          <Btn tone="ink" block onClick={() => nav('/app/login', { replace: true })}>Back to login</Btn>
        </div>
      </section>
    );
  }

  if (slow) {
    return (
      <section className="screen screen--bare">
        <Band tone="blue" pb={46} eyebrow="Members app" title={<>This is taking<br />too long.</>} titleStyle={{ fontSize: 'clamp(32px,10cqw,42px)' }} />
        <div className="pad stack" style={{ marginTop: 20 }}>
          <Btn tone="ink" block onClick={() => window.location.reload()}>Try again</Btn>
          <Btn tone="line" block onClick={() => nav('/app/login', { replace: true })}>Back to login</Btn>
        </div>
      </section>
    );
  }

  return <Splash label="Signing you in…" />;
}

export default function AuthCallback() {
  return <AppFrame><Inner /></AppFrame>;
}
