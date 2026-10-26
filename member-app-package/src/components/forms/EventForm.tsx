/**
 * src/components/forms/EventForm.tsx
 * Shared by the lead app and (later) the admin panel.
 *   fixedDomainId set   -> lead mode: audience forced to that domain, no "everyone" option
 *   fixedDomainId unset -> admin mode: audience + domain pickers
 * Times are typed and shown in IST. reminder_sent_at is never sent: the database re-arms it when starts_at changes.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isoToIstLocal, istLocalToIso } from '../../lib/format';
import { Btn, ErrorLine, Note, useOnline } from '../member/ui';

export type EventDraft = {
  id?: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  audience: 'all' | 'domain';
  domain_id: string | null;
  attendance_opens_at: string | null;
  attendance_closes_at: string | null;
  reminder_minutes?: number;
  cancelled?: boolean;
};

export type EventSaved = { id: string; title: string; justCancelled: boolean };

export default function EventForm({
  fixedDomainId, fixedDomainName, initial, submitLabel, onSaved, onCancel,
}: {
  fixedDomainId?: string;
  fixedDomainName?: string;
  initial?: EventDraft;
  submitLabel?: string;
  onSaved: (o: EventSaved) => void;
  onCancel?: () => void;
}) {
  const online = useOnline();
  const lead = !!fixedDomainId;
  const editing = !!initial?.id;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [starts, setStarts] = useState(isoToIstLocal(initial?.starts_at));
  const [ends, setEnds] = useState(isoToIstLocal(initial?.ends_at));
  const [opens, setOpens] = useState(isoToIstLocal(initial?.attendance_opens_at));
  const [closes, setCloses] = useState(isoToIstLocal(initial?.attendance_closes_at));
  const [reminder, setReminder] = useState(String(initial?.reminder_minutes ?? 30));
  const [cancelled, setCancelled] = useState(initial?.cancelled ?? false);
  const [advanced, setAdvanced] = useState(!!(initial?.attendance_opens_at || initial?.attendance_closes_at || (initial?.reminder_minutes ?? 30) !== 30));
  const [audience, setAudience] = useState<'all' | 'domain'>(lead ? 'domain' : initial?.audience ?? 'all');
  const [domainId, setDomainId] = useState(fixedDomainId ?? initial?.domain_id ?? '');
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (lead) return;
    supabase.from('domains').select('id,name').order('name').then(({ data }) => setDomains((data ?? []) as { id: string; name: string }[]));
  }, [lead]);

  const validate = (): string | null => {
    if (!title.trim()) return 'Add a title.';
    if (title.length > 120) return 'The title is too long (max 120).';
    if (desc.length > 2000) return 'The description is too long (max 2000).';
    if (venue.length > 120) return 'The venue is too long (max 120).';
    if (!starts) return 'Pick a start time.';
    const s = new Date(istLocalToIso(starts)).getTime();
    if (ends && new Date(istLocalToIso(ends)).getTime() <= s) return 'The end must be after the start.';
    if (opens && closes && new Date(istLocalToIso(closes)).getTime() <= new Date(istLocalToIso(opens)).getTime()) return 'Check-in must close after it opens.';
    const r = Number(reminder);
    if (!Number.isInteger(r) || r < 5 || r > 1440) return 'Reminder must be between 5 and 1440 minutes.';
    if (!lead && audience === 'domain' && !domainId) return 'Pick a domain.';
    return null;
  };

  const submit = async () => {
    if (busy) return;
    const v = validate();
    if (v) { setErr(v); return; }
    if (!navigator.onLine) { setErr("You're offline. Saving needs internet."); return; }
    setErr(null); setBusy(true);

    const base = {
      title: title.trim(),
      description: desc.trim() || null,
      venue: venue.trim() || null,
      starts_at: istLocalToIso(starts),
      ends_at: ends ? istLocalToIso(ends) : null,
      audience: lead ? 'domain' : audience,
      domain_id: lead ? fixedDomainId! : audience === 'domain' ? domainId : null,
      attendance_opens_at: opens ? istLocalToIso(opens) : null,
      attendance_closes_at: closes ? istLocalToIso(closes) : null,
      reminder_minutes: Number(reminder),
    };

    const res = editing
      ? await supabase.from('events').update({ ...base, cancelled }).eq('id', initial!.id!).select('id').single()
      : await supabase.from('events').insert(base).select('id').single();

    setBusy(false);
    if (res.error || !res.data) {
      const m = res.error?.message ?? '';
      setErr(/row-level security|permission denied|42501/i.test(m) ? 'You no longer have access to change this event.'
        : /ev_time_chk/i.test(m) ? 'The end must be after the start.'
          : "Couldn't save. Try again.");
      return;
    }
    onSaved({ id: res.data.id as string, title: title.trim(), justCancelled: editing && cancelled && !initial?.cancelled });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      {lead ? (
        <Note style={{ marginTop: 14 }}>
          This event is for <strong>{fixedDomainName ?? 'your domain'} members only</strong>. Events for everyone are created by the core team.
        </Note>
      ) : (
        <div className="field">
          <span className="label">Audience</span>
          <div className="radio">
            <label><input type="radio" name="eaud" checked={audience === 'all'} onChange={() => setAudience('all')} /><span>Everyone</span></label>
            <label><input type="radio" name="eaud" checked={audience === 'domain'} onChange={() => setAudience('domain')} /><span>One domain</span></label>
          </div>
          {audience === 'domain' && (
            <div className="control">
              <select className="input" aria-label="Domain" value={domainId} onChange={(e) => setDomainId(e.target.value)} style={{ paddingRight: 18 }}>
                <option value="">Choose a domain…</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="e-title">Title</label>
        <div className="control"><input id="e-title" className="input" style={{ paddingRight: 18 }} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
        <p className="counter">{title.length} / 120</p>
      </div>

      <div className="field">
        <label className="label" htmlFor="e-venue">Venue <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
        <div className="control"><input id="e-venue" className="input" style={{ paddingRight: 18 }} value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} placeholder="Room 204, CS Block" /></div>
      </div>

      <div className="field">
        <label className="label" htmlFor="e-desc">Description <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
        <div className="control"><textarea id="e-desc" className="input" value={desc} maxLength={2000} onChange={(e) => setDesc(e.target.value)} /></div>
        <p className="counter">{desc.length} / 2000</p>
      </div>

      <div className="field">
        <label className="label" htmlFor="e-start">Starts <span className="muted" style={{ fontWeight: 500 }}>(IST)</span></label>
        <div className="control"><input id="e-start" className="input" style={{ paddingRight: 18 }} type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
      </div>
      <div className="field">
        <label className="label" htmlFor="e-end">Ends <span className="muted" style={{ fontWeight: 500 }}>(optional, IST)</span></label>
        <div className="control"><input id="e-end" className="input" style={{ paddingRight: 18 }} type="datetime-local" min={starts || undefined} value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
      </div>

      <button type="button" className="linkbtn" style={{ marginTop: 18 }} aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
        {advanced ? 'Hide advanced' : 'Advanced: check-in window and reminder'}
      </button>
      {advanced && (
        <>
          <div className="field">
            <label className="label" htmlFor="e-open">Check-in opens <span className="muted" style={{ fontWeight: 500 }}>(default: 30 min before)</span></label>
            <div className="control"><input id="e-open" className="input" style={{ paddingRight: 18 }} type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="e-close">Check-in closes <span className="muted" style={{ fontWeight: 500 }}>(default: at the end)</span></label>
            <div className="control"><input id="e-close" className="input" style={{ paddingRight: 18 }} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="e-rem">Reminder (minutes before)</label>
            <div className="control"><input id="e-rem" className="input" style={{ paddingRight: 18 }} inputMode="numeric" value={reminder} onChange={(e) => setReminder(e.target.value.replace(/\D/g, '').slice(0, 4))} /></div>
            <p className="hint">Between 5 and 1440. Changing the start time re-arms the reminder automatically.</p>
          </div>
        </>
      )}

      {editing && (
        <label className="check">
          <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />
          <span><b>Event is cancelled</b><span className="small muted" style={{ display: 'block', marginTop: 2 }}>Members see it as cancelled and can't check in.</span></span>
        </label>
      )}

      {err && <ErrorLine>{err}</ErrorLine>}
      <Btn tone="ink" block type="submit" style={{ marginTop: 22 }} loading={busy} disabled={!online}>
        {submitLabel ?? (editing ? 'Save changes' : 'Create event')}
      </Btn>
      {onCancel && <Btn tone="line" block type="button" style={{ marginTop: 10 }} onClick={onCancel} disabled={busy}>Cancel</Btn>}
      {!online && <p className="small muted" style={{ textAlign: 'center', marginTop: 12 }}>You're offline. Saving needs internet.</p>}
    </form>
  );
}
