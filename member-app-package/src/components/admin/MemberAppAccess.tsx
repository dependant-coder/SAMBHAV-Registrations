/**
 * src/components/admin/MemberAppAccess.tsx
 * Drop-in "App access" section for the existing admin Members pop-up:  <MemberAppAccess memberId={m.id} />
 * Login status, temporary PIN (shown once), unlock, regenerate ID, unlink login, domain role.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ConfirmSheet from '../member/ConfirmSheet';
import { Btn, Chip, ErrorLine, FixedPortal, Note, Spinner, useToast } from '../member/ui';
import { fmtDateTime, waLink } from '../../lib/format';
import { AdminEmbed } from './AdminFrame';

type Status = {
  google_linked?: boolean; has_pin?: boolean; pin_locked?: boolean; last_sign_in_at?: string | null; device_count?: number;
  public_id?: string | null;
};
type MemberLite = { id: string; name: string; phone: string | null; roll_number: string | null; domain_id: string | null; status: string };
type Role = 'none' | 'colead' | 'lead';
type Act = 'reset' | 'remove' | 'unlock' | 'unlink' | 'regen' | null;

const ROLE_ERR: Record<string, string> = {
  lead_exists: 'This domain already has a lead. Make the current lead a co-lead or remove them first.',
  member_not_approved: 'Only approved members can hold a role.',
  member_not_in_domain: 'The member has no domain yet.',
  forbidden: 'Only a super admin can change roles.',
};

function Inner({ memberId }: { memberId: string }) {
  const toast = useToast();
  const [member, setMember] = useState<MemberLite | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [role, setRole] = useState<Role>('none');
  const [error, setError] = useState('');
  const [act, setAct] = useState<Act>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<string | null>(null);   // shown ONCE, cleared on close
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleErr, setRoleErr] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [m, s, r] = await Promise.all([
      supabase.from('members').select('id,name,phone,roll_number,domain_id,status').eq('id', memberId).maybeSingle(),
      supabase.rpc('admin_member_app_status', { p_member: memberId }),
      supabase.from('domain_roles').select('role').eq('member_id', memberId).maybeSingle(),
    ]);
    if (m.error || s.error) { setError("Couldn't load app access."); return; }
    setMember((m.data as MemberLite | null) ?? null);
    const row = Array.isArray(s.data) ? s.data[0] : s.data;
    setSt((row ?? {}) as Status);
    setRole(((r.data as { role?: Role } | null)?.role as Role) ?? 'none');
  }, [memberId]);
  useEffect(() => { setSt(null); setMember(null); setPin(null); void load(); }, [load]);

  const run = async () => {
    if (!act) return;
    setBusy(true);
    const p = { p_member: memberId };
    let res;
    if (act === 'reset') res = await supabase.rpc('admin_reset_member_pin', p);
    else if (act === 'remove') res = await supabase.rpc('admin_remove_member_pin', p);
    else if (act === 'unlock') res = await supabase.rpc('admin_unlock_member_pin', p);
    else if (act === 'unlink') res = await supabase.rpc('admin_unlink_member_login', p);
    else res = await supabase.rpc('admin_regen_public_id', p);
    setBusy(false);
    const was = act; setAct(null);
    if (res.error) { toast("That didn't work. Try again."); return; }
    if (was === 'reset') {
      const d = res.data as unknown;
      const v = typeof d === 'string' ? d : (d as { pin?: string; temp_pin?: string } | null)?.pin ?? (d as { temp_pin?: string } | null)?.temp_pin;
      if (v) setPin(String(v)); else toast('PIN reset');
    } else toast(({ remove: 'PIN removed', unlock: 'PIN unlocked', unlink: 'Login unlinked', regen: 'New ID generated' } as Record<string, string>)[was]);
    void load();
  };

  const changeRole = async (next: Role) => {
    setRoleErr(''); setRoleBusy(true);
    const { error: e } = await supabase.rpc('admin_set_domain_role', { p_member: memberId, p_domain: member?.domain_id, p_role: next === 'none' ? null : next });
    setRoleBusy(false);
    if (e) { const k = Object.keys(ROLE_ERR).find((x) => e.message.includes(x)); setRoleErr(k ? ROLE_ERR[k] : "Couldn't change the role."); return; }
    setRole(next); toast(next === 'none' ? 'Role removed' : next === 'lead' ? 'Now the lead' : 'Now a co-lead');
  };

  const closePin = () => setPin(null);
  const copy = async () => { try { await navigator.clipboard.writeText(pin ?? ''); toast('Copied'); } catch { toast("Couldn't copy"); } };

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!st || !member) return <div style={{ padding: 12 }}><Spinner /></div>;

  const TEXT: Record<Exclude<Act, null>, { t: string; x: string; c: string; d?: boolean }> = {
    reset: { t: 'Generate a temporary PIN?', x: 'Any current PIN stops working. You will see the new one once.', c: 'Generate' },
    remove: { t: 'Remove this PIN?', x: 'They can still sign in with Google.', c: 'Remove', d: true },
    unlock: { t: 'Unlock this PIN?', x: 'The failed-attempt counter is cleared.', c: 'Unlock' },
    unlink: { t: 'Unlink their login?', x: 'They are signed out everywhere and must sign in again to re-link.', c: 'Unlink', d: true },
    regen: { t: 'Make a new membership ID?', x: 'The old ID card and QR code stop working. Their member number changes.', c: 'Regenerate', d: true },
  };
  const a = act ? TEXT[act] : null;

  return (
    <section aria-label="App access" style={{ display: 'grid', gap: 14 }}>
      <h3 className="h3" style={{ fontSize: 20 }}>App access</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Chip tone={st.google_linked ? 'mint' : 'deep'} small>{st.google_linked ? 'Google linked' : 'Not signed in yet'}</Chip>
        <Chip tone={st.has_pin ? 'blue' : 'deep'} small>{st.pin_locked ? 'PIN locked' : st.has_pin ? 'PIN set' : 'No PIN'}</Chip>
        <Chip tone="deep" small>{st.device_count ?? 0} device{st.device_count === 1 ? '' : 's'} with notifications</Chip>
      </div>
      <p className="tiny muted">Last signed in: {st.last_sign_in_at ? fmtDateTime(st.last_sign_in_at) : 'never'}{st.public_id ? ` · ID ${st.public_id.slice(0, 6)}…` : ''}</p>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Btn tone="ink" size="sm" onClick={() => setAct('reset')}>Generate temporary PIN</Btn>
        {st.has_pin && <Btn tone="line" size="sm" onClick={() => setAct('remove')}>Remove PIN</Btn>}
        {st.pin_locked && <Btn tone="sun" size="sm" onClick={() => setAct('unlock')}>Unlock PIN</Btn>}
        <Btn tone="line" size="sm" onClick={() => setAct('regen')}>Regenerate ID</Btn>
        {st.google_linked && <Btn tone="white" size="sm" onClick={() => setAct('unlink')}>Unlink login</Btn>}
      </div>

      <div>
        <label className="label" htmlFor="role-sel">Domain role</label>
        <select id="role-sel" className="select" value={role} disabled={roleBusy || member.status !== 'approved'} onChange={(e) => void changeRole(e.target.value as Role)}>
          <option value="none">None</option><option value="colead">Co-lead</option><option value="lead">Lead</option>
        </select>
        {member.status !== 'approved' && <p className="tiny muted" style={{ marginTop: 6 }}>Approve the member first to give a role.</p>}
        {roleErr && <ErrorLine>{roleErr}</ErrorLine>}
      </div>

      {a && <ConfirmSheet open title={a.t} text={a.x} confirmLabel={a.c} danger={a.d} busy={busy} onConfirm={run} onCancel={() => setAct(null)} />}

      {pin && (
        <FixedPortal>
          <div className="overlay" role="dialog" aria-modal="true" aria-label="Temporary PIN">
            <div className="sheet" style={{ textAlign: 'center' }}>
              <h2 className="h3" style={{ fontSize: 22 }}>Temporary PIN for {member.name}</h2>
              <p style={{ fontSize: 44, fontWeight: 800, letterSpacing: 8, margin: '16px 0' }} aria-label={`PIN ${pin.split('').join(' ')}`}>{pin}</p>
              <Note tone="warn" style={{ textAlign: 'left' }}>Shown only once. They will be asked to set their own PIN after signing in.</Note>
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <Btn tone="ink" block onClick={copy}>Copy</Btn>
                {waLink(member.phone, `Your Sambhav temporary PIN is ${pin}. Sign in with your member number and this PIN, then set your own PIN.`) && (
                  <a className="btn btn--mint btn--block" target="_blank" rel="noopener noreferrer"
                    href={waLink(member.phone, `Your Sambhav temporary PIN is ${pin}. Sign in with your member number and this PIN, then set your own PIN.`) ?? '#'}>Send on WhatsApp</a>
                )}
                <Btn tone="line" block onClick={closePin}>Done</Btn>
              </div>
            </div>
          </div>
        </FixedPortal>
      )}
    </section>
  );
}

export default function MemberAppAccess({ memberId }: { memberId: string }) {
  return <AdminEmbed><Inner memberId={memberId} /></AdminEmbed>;
}
