/**
 * src/pages/member/SetPin.tsx   (route /app/set-pin, inside MemberGuard but OUTSIDE AppShell)
 * Forced after a temporary PIN (no way out except saving or signing out); optional otherwise.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useMember } from '../../contexts/MemberContext';
import { AppFrame, Band, Btn, CellsInput, ErrorLine, Ic, Note, useOnline, useToast } from '../../components/member/ui';

function Inner() {
  const { member, refresh, signOut } = useMember();
  const nav = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const forced = !!member?.pin_must_change;

  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (a.length !== 6) { setErr('Use exactly 6 digits.'); return; }
    if (a !== b) { setErr("The two PINs don't match."); return; }
    setErr(null); setBusy(true);
    const { error } = await supabase.rpc('set_my_pin', { new_pin: a });   // typed values are kept on failure
    if (error) {
      setBusy(false);
      const m = error.message ?? '';
      if (m.includes('weak_pin')) setErr('That PIN is too easy to guess. Try another.');
      else if (m.includes('invalid_pin')) setErr('Use exactly 6 digits.');
      else if (!navigator.onLine || /fetch|network/i.test(m)) setErr('No connection. Your PIN was not saved. Try again.');
      else setErr("Couldn't save your PIN. Try again.");
      return;
    }
    await refresh();
    toast('PIN saved');
    nav('/app', { replace: true });
  };

  return (
    <section className="screen screen--bare">
      <Band
        tone="ink" pb={46}
        eyebrow={forced ? 'One quick step' : 'Backup PIN'}
        title={<>Choose your<br />own PIN.</>}
        titleStyle={{ fontSize: 'clamp(32px,10cqw,42px)' }}
        sub={forced
          ? 'You signed in with a temporary PIN. Pick a new 6-digit PIN only you know.'
          : 'Pick a 6-digit PIN. You will use it with your roll number when Google is not available.'}
      />
      <div className="pad">
        <div className="field">
          <span className="label" id="np">New PIN</span>
          <CellsInput label="New PIN" value={a} onChange={(v) => { setA(v); setErr(null); }} masked autoFocus />
        </div>
        <div className="field">
          <span className="label" id="cp">Confirm new PIN</span>
          <CellsInput label="Confirm new PIN" value={b} onChange={(v) => { setB(v); setErr(null); }} masked error={!!err} onEnter={save} />
          {err && <ErrorLine>{err}</ErrorLine>}
        </div>

        <Note style={{ marginTop: 18 }}>
          Use 6 digits. Avoid <strong>123456</strong>, <strong>111111</strong> or your birth year.
        </Note>

        <Btn tone="ink" block style={{ marginTop: 22 }} onClick={save} loading={busy} disabled={!online || a.length < 6 || b.length < 6}>
          Save PIN
        </Btn>

        {forced ? (
          <Btn
            tone="white" block style={{ marginTop: 12 }}
            onClick={async () => { await signOut(); nav('/app/login', { replace: true }); }}
          >
            <Ic n="out" />Sign out
          </Btn>
        ) : (
          <Btn tone="line" block style={{ marginTop: 12 }} onClick={() => nav(-1)}>Cancel</Btn>
        )}
        {!online && <p className="small muted" style={{ textAlign: 'center', marginTop: 12 }}>You're offline. Saving needs internet.</p>}
      </div>
    </section>
  );
}

export default function SetPin() {
  return <AppFrame><Inner /></AppFrame>;
}
