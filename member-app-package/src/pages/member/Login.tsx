/**
 * src/pages/member/Login.tsx   (route /app/login, outside MemberGuard)
 * Google sign-in + roll number / PIN backup. PIN login goes through the `pin-login` Edge Function,
 * which returns a one-time token_hash that we turn into a real session with verifyOtp.
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useMember } from '../../contexts/MemberContext';
import { fromState, rememberFrom } from '../../lib/nav';
import { AppFrame, Band, Banner, Btn, ErrorLine, Ic, OfflineBar, useOnline, useToast } from '../../components/member/ui';
import InstallBanner from '../../components/InstallBanner';

const IN_APP = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i;

/** supabase-js hides the JSON body of non-2xx function replies inside error.context */
async function fnErrorCode(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.clone().json();
      if (j?.error) return String(j.error);
      if (ctx.status === 429) return 'too_many';
    }
  } catch { /* fall through */ }
  return 'network';
}

function LoginInner() {
  const { state } = useMember();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const from = fromState(loc.state);

  const [roll, setRoll] = useState('');
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<null | 'google' | 'pin'>(null);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [gErr, setGErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const inApp = IN_APP.test(navigator.userAgent);

  // already signed in (or signed in but blocked/pending): the guard decides what to show
  useEffect(() => {
    if (busy === 'pin' && state.kind !== 'loading' && state.kind !== 'signed_out') nav(from, { replace: true });
  }, [state.kind, busy, from, nav]);
  if (state.kind === 'ready') return <Navigate to={from} replace />;

  const google = async () => {
    setGErr(null); setBusy('google');
    rememberFrom(from);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) { setGErr("Couldn't start Google sign-in. Try again."); setBusy(null); }
  };

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const r = roll.trim().toUpperCase();
    if (!r || pin.length !== 6) { setPinErr('Roll number or PIN is incorrect.'); return; }
    setPinErr(null); setLocked(false); setBusy('pin');

    const { data, error } = await supabase.functions.invoke('pin-login', { body: { roll: r, pin } });
    if (error || !data?.token_hash) {
      const code = error ? await fnErrorCode(error) : 'server';
      setBusy(null);
      if (code === 'locked') { setLocked(true); setPinErr(null); }
      else if (code === 'too_many') setPinErr('Too many attempts from this network. Wait a few minutes.');
      else if (code === 'invalid') setPinErr('Roll number or PIN is incorrect.');
      else if (code === 'conflict') setPinErr('This account is linked to another login. Ask the core team to reset it.');
      else setPinErr("Couldn't reach the server. Check your internet and try again.");
      return;
    }

    rememberFrom(from);
    let res = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (res.error) res = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' }); // older/newer supabase-js
    if (res.error) { setBusy(null); setPinErr("Couldn't sign you in. Try again."); return; }
    // MemberContext picks up SIGNED_IN; the effect above then navigates.
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link copied'); }
    catch { toast("Couldn't copy. Long-press the address bar."); }
  };

  const disabled = !online || busy !== null;

  return (
    <section className="screen screen--bare">
      <OfflineBar />
      <Band
        tone="blue" brandTo="/"
        right={<span className="chip">Members</span>}
        eyebrow="Members app"
        title={<>Welcome<br />back.</>}
        sub="Announcements, events and your member ID, all in one place."
      />

      <div className="banners">
        {inApp && (
          <Banner tone="warn">
            <strong>Open this page in Chrome or Safari.</strong> Google sign-in doesn't work inside Instagram or WhatsApp.{' '}
            <button className="linkbtn" onClick={copyLink}>Copy link</button> or use your PIN below.
          </Banner>
        )}
        {locked && <Banner tone="err"><strong>Too many attempts.</strong> Try again in 15 minutes, or continue with Google.</Banner>}
        {gErr && <Banner tone="err"><strong>{gErr}</strong></Banner>}
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <button className="gbtn" onClick={google} disabled={disabled || inApp}>
          {busy === 'google' ? <span className="spin" /> : <span className="g" />}
          <span>Continue with Google</span>
        </button>
        <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>Use the Google account you registered with.</p>

        <div className="or">or</div>

        <div className="pinbox">
          <button
            type="button" className="row" aria-expanded={open}
            style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="item__ic item__ic--sun"><Ic n="lock" /></span>
            <span className="grow">
              <span className="h3" style={{ display: 'block' }}>Roll number + PIN</span>
              <span className="small muted">Backup way to sign in</span>
            </span>
            <Ic n="chev" style={{ rotate: open ? '90deg' : '0deg' }} />
          </button>

          {open && (
            <form onSubmit={submitPin} autoComplete="off" noValidate>
              <div className="field">
                <label className="label" htmlFor="roll">Roll number</label>
                <div className="control">
                  <input
                    id="roll" className="input input--caps" value={roll} onChange={(e) => setRoll(e.target.value)}
                    autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="username" maxLength={32}
                  />
                </div>
              </div>
              <div className={`field${pinErr ? ' field--err' : ''}`}>
                <label className="label" htmlFor="pin">6-digit PIN</label>
                <div className="control">
                  <input
                    id="pin" className="input input--pin" value={pin}
                    type={show ? 'text' : 'password'} inputMode="numeric" maxLength={6} placeholder="••••••"
                    autoComplete="current-password"
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button type="button" className="eye" aria-label={show ? 'Hide PIN' : 'Show PIN'} onClick={() => setShow((s) => !s)}>
                    <Ic n="eye" />
                  </button>
                </div>
                {pinErr && <ErrorLine>{pinErr}</ErrorLine>}
              </div>
              <Btn tone="ink" block type="submit" style={{ marginTop: 20 }} loading={busy === 'pin'} disabled={disabled}>Sign in</Btn>
              <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
                No PIN yet? Use Google, or ask the core team for a temporary PIN.
              </p>
            </form>
          )}
        </div>

        <div className="sec"><InstallBanner dismissable /></div>

        <p className="small" style={{ textAlign: 'center', marginTop: 26 }}>
          Not registered yet? <Link to="/register" className="linkbtn">Register now</Link>
        </p>
      </div>
    </section>
  );
}

export default function MemberLogin() {
  return <AppFrame><LoginInner /></AppFrame>;
}
