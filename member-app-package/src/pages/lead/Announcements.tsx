/**
 * src/pages/lead/Announcements.tsx   (route /app/lead/announcements, ?new=1 opens the composer)
 * The lead's own-domain announcements with status, push status and a daily push counter.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLead, DomainSwitcher } from '../../components/LeadGuard';
import AnnouncementForm from '../../components/forms/AnnouncementForm';
import type { AnnouncementDraft } from '../../components/forms/AnnouncementForm';
import ConfirmSheet from '../../components/member/ConfirmSheet';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { BackBar, Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, useToast } from '../../components/member/ui';

type Row = AnnouncementDraft & { id: string; published_at: string; push_sent_count: number | null };

const COLS = 'id,title,body,audience,domain_id,pinned,link_url,published_at,expires_at,push_sent_at,push_sent_count';
const DAILY = 5;

function statusOf(r: Row) {
  const t = Date.now();
  if (new Date(r.published_at).getTime() > t) return { label: 'Scheduled', tone: 'sun' as const };
  if (r.expires_at && new Date(r.expires_at).getTime() <= t) return { label: 'Expired', tone: 'deep' as const };
  return { label: 'Live', tone: 'mint' as const };
}

export default function LeadAnnouncements() {
  const { role } = useLead();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const composing = sp.get('new') === '1';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: e } = await supabase.from('announcements').select(COLS)
      .eq('audience', 'domain').eq('domain_id', role.domain_id).order('published_at', { ascending: false }).limit(40);
    if (e) { setError(true); return; }
    setRows((data ?? []) as Row[]);

    // pushes used in the last 24 h by this person
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (uid) {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('push_sent_by', uid).gte('push_sent_at', since);
      setLeft(Math.max(0, DAILY - (count ?? 0)));
    }
  }, [role.domain_id]);

  useEffect(() => { setRows(null); void load(); }, [load]);

  const closeForm = () => { setEditing(null); const n = new URLSearchParams(sp); ['new', 'title', 'body'].forEach((k) => n.delete(k)); setSp(n, { replace: true }); };

  const doDelete = async () => {
    if (!del) return;
    setDelBusy(true);
    const { error: e } = await supabase.from('announcements').delete().eq('id', del.id);
    setDelBusy(false);
    if (e) { toast("Couldn't delete. Try again."); } else { toast('Announcement deleted'); setRows((r) => (r ?? []).filter((x) => x.id !== del.id)); }
    setDel(null);
  };

  /* ---------------- composer / editor ---------------- */
  if (composing || editing) {
    return (
      <section className="screen">
        <BackBar label="Announcements" onBack={closeForm} />
        <div className="pad" style={{ marginTop: 6 }}>
          <p className="eyebrow">{editing ? 'Edit announcement' : 'New announcement'}</p>
          <h1 className="h2">{editing ? 'Edit post' : `Post to ${role.domain_name}`}</h1>
          <DomainSwitcher />
          <AnnouncementForm
            key={editing?.id ?? 'new'}
            fixedDomainId={role.domain_id}
            fixedDomainName={role.domain_name}
            initial={editing ?? (sp.get('title') || sp.get('body')
              ? { title: (sp.get('title') ?? '').slice(0, 120), body: (sp.get('body') ?? '').slice(0, 2000), audience: 'domain', domain_id: role.domain_id, pinned: false, link_url: null }
              : undefined)}
            pushLeft={left}
            onCancel={closeForm}
            onSaved={({ pushed, pushNote }) => {
              toast(pushNote ?? (pushed != null ? `Posted and notified ${pushed} device${pushed === 1 ? '' : 's'}` : editing ? 'Changes saved' : 'Announcement posted'));
              closeForm();
              void load();
            }}
          />
        </div>
      </section>
    );
  }

  /* ---------------- list ---------------- */
  return (
    <section className="screen">
      <BackBar to="/app/lead" label="Lead tools" />
      <div className="pad" style={{ marginTop: 6 }}>
        <p className="eyebrow">{role.domain_name}</p>
        <h1 className="h2">Announcements</h1>
        <DomainSwitcher />
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <Link className="btn btn--ink grow" to="/app/lead/announcements?new=1"><Ic n="plus" />New announcement</Link>
        </div>
        {left != null && <p className="small muted" style={{ marginTop: 10 }}>Notifications left today: <b>{left} of {DAILY}</b></p>}

        <div style={{ marginTop: 16 }}>
          {!rows && !error ? <ListSkeleton rows={3} /> : error ? <LoadError onRetry={() => void load()} /> :
            rows && rows.length === 0 ? <EmptyState title="No announcements yet." text="Post one to reach your domain." /> :
              rows?.map((r) => {
                const st = statusOf(r);
                return (
                  <div className="item" key={r.id} style={{ cursor: 'default', display: 'block' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <span className="grow">
                        <span className="item__t">{r.title}</span>
                        <span className="item__p">{r.body}</span>
                      </span>
                      <Chip tone={st.tone} small>{st.label}</Chip>
                    </div>
                    <div className="item__m">
                      <span title={fmtDateTime(r.published_at)}>{new Date(r.published_at).getTime() > Date.now() ? `Goes live ${fmtDateTime(r.published_at)}` : timeAgo(r.published_at)}</span>
                      <span>·</span>
                      <span>{r.push_sent_at ? `Sent to ${r.push_sent_count ?? 0} devices` : 'Not sent'}</span>
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 12 }}>
                      <Btn tone="line" size="sm" onClick={() => setEditing(r)}>Edit</Btn>
                      <Btn tone="white" size="sm" onClick={() => setDel(r)}>Delete</Btn>
                      {st.label === 'Live' && <Link className="linkbtn small" style={{ marginLeft: 'auto' }} to={`/app/announcements/${r.id}`}>View</Link>}
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      <ConfirmSheet
        open={!!del} title="Delete this announcement?" text="Members will no longer see it. This is recorded in the audit log."
        confirmLabel="Delete" danger busy={delBusy} onConfirm={doDelete} onCancel={() => setDel(null)}
      />
    </section>
  );
}
