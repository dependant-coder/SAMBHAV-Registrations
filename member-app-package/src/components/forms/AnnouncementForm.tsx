/**
 * src/components/forms/AnnouncementForm.tsx
 * Shared by the lead app and (later) the admin panel.
 *   fixedDomainId set   -> lead mode: audience is forced to that domain, no "everyone" option exists
 *   fixedDomainId unset -> admin mode: audience + domain pickers, pin toggle, no daily push limit
 * The database enforces the same rules, so the UI restriction is only for convenience.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isoToIstLocal, istLocalToIso } from '../../lib/format';
import { Btn, ErrorLine, Note, useOnline } from '../member/ui';

export type AnnouncementDraft = {
  id?: string;
  title: string;
  body: string;
  audience: 'all' | 'domain';
  domain_id: string | null;
  pinned: boolean;
  link_url: string | null;
  published_at?: string;
  expires_at?: string | null;
  push_sent_at?: string | null;
};

export type SaveOutcome = { id: string; pushed: number | null; pushNote: string | null };

const fromLocal = istLocalToIso;
const toLocal = isoToIstLocal;
const nowLocal = () => toLocal(new Date().toISOString());

export default function AnnouncementForm({
  fixedDomainId, fixedDomainName, initial, pushLeft, submitLabel, onSaved, onCancel,
}: {
  fixedDomainId?: string;
  fixedDomainName?: string;
  initial?: AnnouncementDraft;
  /** leads only: pushes left in the rolling 24 h (null = unknown, undefined = no limit) */
  pushLeft?: number | null;
  submitLabel?: string;
  onSaved: (o: SaveOutcome) => void;
  onCancel?: () => void;
}) {
  const online = useOnline();
  const editing = !!initial?.id;
  const lead = !!fixedDomainId;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [link, setLink] = useState(initial?.link_url ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [audience, setAudience] = useState<'all' | 'domain'>(lead ? 'domain' : initial?.audience ?? 'all');
  const [domainId, setDomainId] = useState<string>(fixedDomainId ?? initial?.domain_id ?? '');
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>(
    initial?.published_at && new Date(initial.published_at).getTime() > Date.now() ? 'later' : 'now',
  );
  const [at, setAt] = useState(toLocal(initial?.published_at && new Date(initial.published_at).getTime() > Date.now() ? initial.published_at : null));
  const [expires, setExpires] = useState(toLocal(initial?.expires_at));
  const [push, setPush] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (lead) return;
    supabase.from('domains').select('id,name').order('name').then(({ data }) => setDomains((data ?? []) as { id: string; name: string }[]));
  }, [lead]);

  const limitHit = lead && pushLeft === 0;
  const canPush = when === 'now' && !limitHit && !initial?.push_sent_at;
  const alreadyPushed = !!initial?.push_sent_at;

  const validate = (): string | null => {
    if (!title.trim()) return 'Add a title.';
    if (title.length > 120) return 'The title is too long (max 120).';
    if (!body.trim()) return 'Write a message.';
    if (body.length > 2000) return 'The message is too long (max 2000).';
    if (link.trim() && !/^https?:\/\/\S+$/i.test(link.trim())) return 'The link must start with http:// or https://';
    if (!lead && audience === 'domain' && !domainId) return 'Pick a domain.';
    if (when === 'later') {
      if (!at) return 'Pick when to publish.';
      if (new Date(fromLocal(at)).getTime() < Date.now() + 60_000) return 'Pick a time in the future.';
    }
    if (expires) {
      const pub = when === 'later' ? new Date(fromLocal(at)).getTime() : Date.now();
      if (new Date(fromLocal(expires)).getTime() <= pub) return 'The expiry must be after the publish time.';
    }
    return null;
  };

  const submit = async () => {
    if (busy) return;
    const v = validate();
    if (v) { setErr(v); return; }
    if (!navigator.onLine) { setErr("You're offline. Saving needs internet."); return; }
    setErr(null); setBusy(true);

    const payload = {
      title: title.trim(),
      body: body.trim(),
      audience: lead ? 'domain' : audience,
      domain_id: lead ? fixedDomainId! : audience === 'domain' ? domainId : null,
      pinned: lead ? false : pinned,
      link_url: link.trim() || null,
      published_at: when === 'later' ? fromLocal(at) : (editing && initial?.published_at && new Date(initial.published_at).getTime() <= Date.now() ? initial.published_at : new Date().toISOString()),
      expires_at: expires ? fromLocal(expires) : null,
    };

    const res = editing
      ? await supabase.from('announcements').update(payload).eq('id', initial!.id!).select('id').single()
      : await supabase.from('announcements').insert(payload).select('id').single();

    if (res.error || !res.data) {
      setBusy(false);
      const m = res.error?.message ?? '';
      setErr(/row-level security|permission denied|42501/i.test(m) ? 'You no longer have access to post here.' : "Couldn't save. Try again.");
      return;
    }
    const id = res.data.id as string;

    // The announcement is saved. A failed push never undoes that.
    let pushed: number | null = null;
    let pushNote: string | null = null;
    if (push && canPush) {
      const { data, error } = await supabase.functions.invoke('send-push', { body: { kind: 'announcement', announcement_id: id } });
      if (error) {
        let code = '';
        try { code = (await (error as { context?: Response }).context?.clone().json())?.error ?? ''; } catch { /* ignore */ }
        pushNote =
          code === 'daily_limit' ? "You've used all 5 notifications for today. The announcement was saved."
            : code === 'not_live' ? 'Saved. It will be visible once it goes live (no notification was sent).'
              : code === 'forbidden' ? "Saved, but you can't send notifications for this announcement."
                : "Saved, but the notification couldn't be sent.";
      } else {
        const d = data as { sent?: number; result?: { sent?: number } } | null;
        pushed = d?.sent ?? d?.result?.sent ?? 0;
      }
    }
    setBusy(false);
    onSaved({ id, pushed, pushNote });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      {lead ? (
        <Note style={{ marginTop: 14 }}>
          This goes to <strong>{fixedDomainName ?? 'your domain'} members only</strong>. To reach everyone, ask the core team.
        </Note>
      ) : (
        <div className="field">
          <span className="label">Audience</span>
          <div className="radio">
            <label><input type="radio" name="aud" checked={audience === 'all'} onChange={() => setAudience('all')} /><span>Everyone</span></label>
            <label><input type="radio" name="aud" checked={audience === 'domain'} onChange={() => setAudience('domain')} /><span>One domain</span></label>
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
        <label className="label" htmlFor="a-title">Title</label>
        <div className="control"><input id="a-title" className="input" style={{ paddingRight: 18 }} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
        <p className="counter">{title.length} / 120</p>
      </div>

      <div className="field">
        <label className="label" htmlFor="a-body">Message</label>
        <div className="control"><textarea id="a-body" className="input" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} /></div>
        <p className="counter">{body.length} / 2000</p>
      </div>

      <div className="field">
        <label className="label" htmlFor="a-link">Link <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
        <div className="control"><input id="a-link" className="input" style={{ paddingRight: 18 }} inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} /></div>
      </div>

      <div className="field">
        <span className="label">When</span>
        <div className="radio">
          <label><input type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} /><span>{editing ? 'Live' : 'Now'}</span></label>
          <label><input type="radio" name="when" checked={when === 'later'} onChange={() => setWhen('later')} /><span>Schedule</span></label>
        </div>
        {when === 'later' && (
          <div className="control">
            <input className="input" style={{ paddingRight: 18 }} type="datetime-local" aria-label="Publish at (IST)" min={nowLocal()} value={at} onChange={(e) => setAt(e.target.value)} />
            <p className="hint">Time is in IST.</p>
          </div>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="a-exp">Hide after <span className="muted" style={{ fontWeight: 500 }}>(optional, IST)</span></label>
        <div className="control"><input id="a-exp" className="input" style={{ paddingRight: 18 }} type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
      </div>

      {!lead && (
        <label className="check">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <span><b>Pin to the top</b></span>
        </label>
      )}

      {alreadyPushed ? (
        <Note tone="warn" style={{ marginTop: 14 }}>Members were already notified about this one. Editing won't send another notification.</Note>
      ) : (
        <label className="check" style={{ opacity: canPush ? 1 : 0.6 }}>
          <input type="checkbox" checked={push && canPush} disabled={!canPush} onChange={(e) => setPush(e.target.checked)} />
          <span>
            <b>Send a push notification now</b>
            <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
              {when === 'later' ? 'Scheduled announcements can only be pushed once they are live.'
                : lead && pushLeft != null ? <>Notifications left today: <b>{pushLeft} of 5</b>.</> : 'Members with notifications on will be pinged.'}
            </span>
          </span>
        </label>
      )}
      {limitHit && !alreadyPushed && <Note tone="warn" style={{ marginTop: 14 }}>You've used all 5 notifications for today. The announcement will still be saved.</Note>}

      {err && <ErrorLine>{err}</ErrorLine>}
      <Btn tone="ink" block type="submit" style={{ marginTop: 22 }} loading={busy} disabled={!online}>
        {submitLabel ?? (editing ? 'Save changes' : 'Post announcement')}
      </Btn>
      {onCancel && <Btn tone="line" block type="button" style={{ marginTop: 10 }} onClick={onCancel} disabled={busy}>Cancel</Btn>}
      {!online && <p className="small muted" style={{ textAlign: 'center', marginTop: 12 }}>You're offline. Saving needs internet.</p>}
    </form>
  );
}
