/**
 * src/pages/member/Profile.tsx   (route /app/profile)
 * Me, ID + lead tools, your leads, notification toggles, backup PIN, attendance, sign out.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { usePush } from '../../hooks/usePush';
import { formatMemberNo } from '../../lib/idcard';
import { waLink } from '../../lib/format';
import InstallBanner from '../../components/InstallBanner';
import ConfirmSheet from '../../components/member/ConfirmSheet';
import { Avatar, Band, Btn, Chip, Ic, Note, useOnline, useToast } from '../../components/member/ui';

type Lead = { name: string; role: 'lead' | 'colead'; phone: string | null };
type Settings = { push_announcements: boolean; push_events: boolean };

export default function Profile() {
  const { member, roles, signOut } = useReadyMember();
  const nav = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const push = usePush();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>({ push_announcements: true, push_events: true });
  const [att, setAtt] = useState<{ total: number; dots: boolean[] } | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signing, setSigning] = useState(false);

  // leads: not cached on purpose (phone numbers)
  useEffect(() => {
    let alive = true;
    supabase.rpc('get_my_domain_leads').then(({ data }) => { if (alive && Array.isArray(data)) setLeads(data as Lead[]); });
    supabase.from('member_settings').select('push_announcements,push_events').eq('member_id', member.id).maybeSingle()
      .then(({ data }) => { if (alive && data) setSettings(data as Settings); });
    return () => { alive = false; };
  }, [member.id]);

  const loadAttendance = useCallback(async () => {
    const [ev, at] = await Promise.all([
      supabase.from('events').select('id,starts_at').eq('cancelled', false).lt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(200),
      supabase.from('attendance').select('event_id'),
    ]);
    if (ev.error || at.error) return;
    const got = new Set((at.data ?? []).map((a) => a.event_id as string));
    const dots = (ev.data ?? []).map((e) => got.has(e.id as string));
    setAtt({ total: dots.length, dots });
  }, []);
  useEffect(() => { void loadAttendance(); }, [loadAttendance]);

  const saveSetting = async (key: keyof Settings, value: boolean) => {
    const prev = settings;
    setSettings({ ...prev, [key]: value });                       // optimistic
    const { error } = await supabase.from('member_settings')
      .upsert({ member_id: member.id, ...prev, [key]: value, updated_at: new Date().toISOString() }, { onConflict: 'member_id' });
    if (error) { setSettings(prev); toast("Couldn't save. Try again."); }
  };

  const toggleMaster = async () => {
    if (!online) { toast("You're offline."); return; }
    if (push.rawStatus === 'on') {
      if (await push.disable()) toast('Notifications turned off on this device');
    } else if (await push.enable()) toast('Notifications turned on');
  };

  const doSignOut = async () => {
    setSigning(true);
    await signOut();                          // works offline too: local session is cleared
    nav('/app/login', { replace: true });
  };

  const attended = att?.dots.filter(Boolean).length ?? 0;
  const pct = att && att.total > 0 ? Math.round((attended / att.total) * 100) : null;
  const masterOn = push.rawStatus === 'on';
  const masterBlocked = push.rawStatus === 'denied' || push.rawStatus === 'unsupported' || push.rawStatus === 'needs_install';
  const roleChip = member.role === 'lead' ? 'Lead' : member.role === 'colead' ? 'Co-lead' : null;

  return (
    <section className="screen">
      <Band tone="pink" pb={46}>
        <div className="row" style={{ marginTop: 22, gap: 16, position: 'relative' }}>
          <Avatar name={member.name} path={member.photo_path} size={84} style={{ boxShadow: '0 0 0 4px var(--paper)' }} />
          <div className="grow">
            <h1 className="band__title" style={{ margin: 0, fontSize: 'clamp(28px,8.5cqw,36px)', overflowWrap: 'anywhere' }}>{member.name}</h1>
            <p style={{ fontWeight: 700, marginTop: 4 }}>{member.roll_number}{member.domain_name ? ` · ${member.domain_name}` : ''}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14, position: 'relative' }}>
          <Chip tone="ink">● Approved</Chip>
          {roleChip && <Chip tone="white">{roleChip}</Chip>}
        </div>
      </Band>

      <div className="pad">
        <div className="sec">
          <Link className="item" to="/app/id" style={{ alignItems: 'center' }}>
            <span className="item__ic item__ic--blue"><Ic n="id" /></span>
            <span className="grow"><span className="item__t">My ID card</span><span className="small muted" style={{ display: 'block' }}>{formatMemberNo(member.member_no)} · shows a QR for check-in</span></span>
            <Ic n="chev" />
          </Link>
          {roles.length > 0 && (
            <Link className="item" to="/app/lead" style={{ alignItems: 'center' }}>
              <span className="item__ic item__ic--sun"><Ic n="shield" /></span>
              <span className="grow"><span className="item__t">Lead tools</span><span className="small muted" style={{ display: 'block' }}>{roles[0].domain_name} · manage your domain</span></span>
              <Ic n="chev" />
            </Link>
          )}
        </div>

        {leads.length > 0 && (
          <div className="sec">
            <div className="sec__head"><h2 className="h3">Your leads</h2></div>
            {leads.map((l, i) => {
              const wa = waLink(l.phone, `Hi ${l.name.split(' ')[0]}, this is ${member.name.split(' ')[0]} from ${member.domain_name ?? 'Sambhav'}. `);
              return (
                <div className="member" key={`${l.name}-${i}`}>
                  <Avatar name={l.name} />
                  <span className="grow">
                    <span className="member__n">{l.name}</span>
                    <span className="member__s" style={{ display: 'block' }}>{l.role === 'lead' ? 'Lead' : 'Co-lead'} · {member.domain_name}</span>
                  </span>
                  {wa && <a className="smallbtn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${l.name}`}><Ic n="chat" /></a>}
                </div>
              );
            })}
          </div>
        )}

        <div className="sec">
          <div className="sec__head"><h2 className="h3">Notifications</h2></div>
          <div className="card stack" style={{ gap: 16 }}>
            <div className="row">
              <span className="grow"><b>Push notifications</b><span className="small muted" style={{ display: 'block' }}>On this device</span></span>
              <button className="sw" role="switch" aria-checked={masterOn} aria-label="Push notifications" disabled={masterBlocked || push.busy || !online} onClick={toggleMaster} />
            </div>
            <div className="row">
              <span className="grow"><b>Announcements</b></span>
              <button className="sw" role="switch" aria-checked={settings.push_announcements} aria-label="Announcements" disabled={!online} onClick={() => saveSetting('push_announcements', !settings.push_announcements)} />
            </div>
            <div className="row">
              <span className="grow"><b>Event reminders</b></span>
              <button className="sw" role="switch" aria-checked={settings.push_events} aria-label="Event reminders" disabled={!online} onClick={() => saveSetting('push_events', !settings.push_events)} />
            </div>
            {push.rawStatus === 'denied' && <Note tone="warn">Notifications are blocked in your browser settings. Open site settings and allow notifications for this app.</Note>}
            {push.rawStatus === 'needs_install' && <Note tone="warn">On iPhone, install the app first (Share → Add to Home Screen), then turn on notifications from the app.</Note>}
            {push.rawStatus === 'unsupported' && <Note tone="warn">This browser can't receive notifications.</Note>}
            {push.error === 'failed' && <Note tone="err">Couldn't update notifications. Try again.</Note>}
            {!online && <p className="small muted">You're offline. Changes need internet.</p>}
          </div>
        </div>

        <div className="sec"><InstallBanner /></div>

        <div className="sec">
          <div className="sec__head"><h2 className="h3">Security</h2></div>
          <div className="card row">
            <span className="item__ic item__ic--mint"><Ic n="lock" /></span>
            <span className="grow"><b>Backup PIN</b><span className="small muted" style={{ display: 'block' }}>{member.has_pin ? 'Set' : 'Not set yet'}</span></span>
            <Link className="btn btn--line btn--sm" to="/app/set-pin">{member.has_pin ? 'Change' : 'Set PIN'}</Link>
          </div>
        </div>

        <div className="sec">
          <div className="sec__head">
            <h2 className="h3">My attendance</h2>
            {att && att.total > 0 && <b style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22 }}>{attended} of {att.total}</b>}
          </div>
          <div className="card">
            {!att ? <div className="skel" style={{ minHeight: 40 }} /> : att.total === 0 ? (
              <p className="small muted">No events have happened yet. Your attendance shows up here.</p>
            ) : (
              <>
                <div className="dots" aria-hidden="true">{att.dots.slice(-60).map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</div>
                <p className="small muted" style={{ marginTop: 12 }}>
                  You've attended {pct}% of events{member.domain_name ? ` for ${member.domain_name}` : ''}.{pct != null && pct >= 70 ? ' Nice work!' : ''}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="sec stack">
          <Link className="btn btn--white btn--block" to="/request-edit"><Ic n="user" />Request a details change</Link>
          <Btn tone="line" block onClick={() => setConfirmOut(true)}><Ic n="out" />Sign out</Btn>
        </div>
      </div>

      <div style={{ padding: '10px 0 0', marginTop: 20 }}>
        <p className="credit" style={{ margin: 0, textAlign: 'center' }}>Built with ♥ by <Link to="/creator">the creator</Link></p>
      </div>

      <ConfirmSheet
        open={confirmOut} title="Sign out?" text="You'll need to sign in again to see your announcements and ID."
        confirmLabel="Sign out" busy={signing} onConfirm={doSignOut} onCancel={() => setConfirmOut(false)}
      />
    </section>
  );
}
