/**
 * src/pages/admin/Announcements.tsx   (route /admin/announcements, inside your admin layout)
 * Every announcement, search + status filter, create / edit / delete, and "Send notification" for live ones.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminFrame, { AdminHeader } from '../../components/admin/AdminFrame';
import AnnouncementForm from '../../components/forms/AnnouncementForm';
import type { AnnouncementDraft } from '../../components/forms/AnnouncementForm';
import ConfirmSheet from '../../components/member/ConfirmSheet';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, useToast } from '../../components/member/ui';

type Row = AnnouncementDraft & {
  id: string; published_at: string; push_sent_count: number | null; domain?: { name: string } | null;
};

const COLS = 'id,title,body,audience,domain_id,pinned,link_url,published_at,expires_at,push_sent_at,push_sent_count,domain:domains(name)';
type Status = 'live' | 'scheduled' | 'expired';

const statusOf = (r: Row): Status => {
  const t = Date.now();
  if (new Date(r.published_at).getTime() > t) return 'scheduled';
  if (r.expires_at && new Date(r.expires_at).getTime() <= t) return 'expired';
  return 'live';
};
const STATUS_UI: Record<Status, { label: string; tone: 'mint' | 'sun' | 'deep' }> = {
  live: { label: 'Live', tone: 'mint' }, scheduled: { label: 'Scheduled', tone: 'sun' }, expired: { label: 'Expired', tone: 'deep' },
};

function Inner() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editing, setEditing] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [push, setPush] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const composing = sp.get('new') === '1';
  const formOpen = composing || !!editing;

  const load = useCallback(async () => {
    setError(false);
    const { data, error: e } = await supabase.from('announcements').select(COLS).order('published_at', { ascending: false }).limit(200);
    if (e) { setError(true); return; }
    setRows(((data ?? []) as unknown as Row[]).map((r) => ({ ...r, domain: Array.isArray(r.domain) ? (r.domain[0] ?? null) : r.domain })));
  }, []);
  useEffect(() => { void load(); }, [load]);

  // unsaved-changes guard while the form is open (closing the tab / reloading)
  useEffect(() => {
    if (!formOpen) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [formOpen]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (filter === 'all' || statusOf(r) === filter) && (!s || r.title.toLowerCase().includes(s) || r.body.toLowerCase().includes(s)));
  }, [rows, q, filter]);

  const closeForm = () => { setEditing(null); const n = new URLSearchParams(sp); ['new', 'title', 'body'].forEach((k) => n.delete(k)); setSp(n, { replace: true }); };

  const doDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error: e } = await supabase.from('announcements').delete().eq('id', del.id);
    setBusy(false);
    if (e) toast("Couldn't delete. Try again."); else { toast('Announcement deleted'); setRows((r) => (r ?? []).filter((x) => x.id !== del.id)); }
    setDel(null);
  };

  const sendPush = async () => {
    if (!push) return;
    setBusy(true);
    const { data, error: e } = await supabase.functions.invoke('send-push', { body: { kind: 'announcement', announcement_id: push.id } });
    setBusy(false); setPush(null);
    if (e) {
      let code = '';
      try { code = (await (e as { context?: Response }).context?.clone().json())?.error ?? ''; } catch { /* ignore */ }
      toast(code === 'not_live' ? 'It is not live yet.' : code === 'already_sent_or_missing' ? 'A notification was already sent.' : "Couldn't send the notification.");
    } else {
      const d = data as { sent?: number; result?: { sent?: number } } | null;
      toast(`Sent to ${d?.sent ?? d?.result?.sent ?? 0} devices`);
    }
    void load();
  };

  if (formOpen) {
    const prefill = !editing && (sp.get('title') || sp.get('body'))
      ? { title: sp.get('title') ?? '', body: sp.get('body') ?? '', audience: 'all' as const, domain_id: null, pinned: false, link_url: null } : undefined;
    return (
      <>
        <AdminHeader eyebrow={editing ? 'Edit announcement' : 'New announcement'} title={editing ? 'Edit post' : 'Compose'} />
        <div style={{ maxWidth: 640 }}>
          <AnnouncementForm
            key={editing?.id ?? 'new'}
            initial={editing ?? prefill}
            onCancel={closeForm}
            onSaved={({ pushed, pushNote }) => {
              toast(pushNote ?? (pushed != null ? `Posted and notified ${pushed} device${pushed === 1 ? '' : 's'}` : editing ? 'Changes saved' : 'Announcement posted'));
              closeForm(); void load();
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        eyebrow="Members app" title="Announcements"
        right={<Btn tone="ink" onClick={() => setSp({ new: '1' })}><Ic n="plus" />New announcement</Btn>}
      />
      <div className="adm__toolbar">
        <div className="control" style={{ marginTop: 0 }}>
          <input className="input" style={{ paddingLeft: 50 }} placeholder="Search title or message" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <Ic n="search" style={{ position: 'absolute', left: 16, top: 18, color: 'var(--ink-soft)' }} />
        </div>
        <select className="select" aria-label="Status" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All statuses</option><option value="live">Live</option><option value="scheduled">Scheduled</option><option value="expired">Expired</option>
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        {!rows && !error ? <ListSkeleton rows={4} /> : error ? <LoadError onRetry={() => void load()} /> :
          shown.length === 0 ? <EmptyState title={rows?.length ? 'No announcements match.' : 'No announcements yet.'} /> : (
            <div className="adm__grid">
              {shown.map((r) => {
                const st = statusOf(r); const ui = STATUS_UI[st];
                return (
                  <div className="item" key={r.id} style={{ cursor: 'default', display: 'block' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <span className="grow"><span className="item__t">{r.pinned ? '📌 ' : ''}{r.title}</span><span className="item__p">{r.body}</span></span>
                      <Chip tone={ui.tone} small>{ui.label}</Chip>
                    </div>
                    <div className="item__m">
                      <Chip tone={r.audience === 'domain' ? 'blue' : 'deep'} small>{r.audience === 'domain' ? (r.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
                      <span title={fmtDateTime(r.published_at)}>{st === 'scheduled' ? `Goes live ${fmtDateTime(r.published_at)}` : timeAgo(r.published_at)}</span>
                      <span>·</span>
                      <span>{r.push_sent_at ? `Sent to ${r.push_sent_count ?? 0} devices` : 'Not sent'}</span>
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Btn tone="line" size="sm" onClick={() => setEditing(r)}>Edit</Btn>
                      <Btn tone="white" size="sm" onClick={() => setDel(r)}>Delete</Btn>
                      {!r.push_sent_at && st === 'live' && <Btn tone="blue" size="sm" onClick={() => setPush(r)}><Ic n="bell" />Send notification</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      <ConfirmSheet open={!!del} title="Delete this announcement?" text={del?.push_sent_at ? 'Members were already notified. Tapping the old notification will say it is no longer available.' : 'Members will no longer see it.'}
        confirmLabel="Delete" danger busy={busy} onConfirm={doDelete} onCancel={() => setDel(null)} />
      <ConfirmSheet open={!!push} title="Send a notification now?" text={`"${push?.title ?? ''}" will be pushed to ${push?.audience === 'domain' ? (push.domain?.name ?? 'that domain') : 'everyone'} with notifications on. This can only be sent once.`}
        confirmLabel="Send" busy={busy} onConfirm={sendPush} onCancel={() => setPush(null)} />
    </>
  );
}

export default function AdminAnnouncements() {
  return <AdminFrame><Inner /></AdminFrame>;
}
