/**
 * src/components/admin/OverviewCards.tsx
 * Four cards for the admin overview: <OverviewCards />
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/format';
import { AdminEmbed } from './AdminFrame';

type D = {
  total: number; linked: number; notif: number;
  ann: { title: string; push_sent_count: number | null; push_sent_at: string | null } | null;
  ev: { id: string; title: string; n: number } | null;
};

function Inner() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const [flags, total, ann, ev] = await Promise.all([
        supabase.rpc('admin_members_app_flags'),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('announcements').select('title,push_sent_count,push_sent_at').lte('published_at', nowIso).order('published_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('events').select('id,title').eq('cancelled', false).gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString()).order('starts_at').limit(1).maybeSingle(),
      ]);
      if (off) return;
      if (flags.error) { setErr(true); return; }
      const rows = (flags.data ?? []) as { on_app?: boolean; has_notifications?: boolean }[];
      let n = 0;
      if (ev.data) {
        const c = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('event_id', (ev.data as { id: string }).id);
        n = c.count ?? 0;
      }
      if (off) return;
      setD({
        total: total.count ?? 0, linked: rows.filter((r) => r.on_app).length, notif: rows.filter((r) => r.has_notifications).length,
        ann: (ann.data as D['ann']) ?? null, ev: ev.data ? { ...(ev.data as { id: string; title: string }), n } : null,
      });
    })();
    return () => { off = true; };
  }, []);

  if (err) return null;
  const v = (x: string | number | null | undefined) => (d ? x : '…');
  return (
    <div className="adm__cards">
      <div className="card"><p className="tiny muted">Members on the app</p><p className="h3">{v(d && `${d.linked} / ${d.total}`)}</p></div>
      <div className="card"><p className="tiny muted">Notifications enabled</p><p className="h3">{v(d?.notif)}</p></div>
      <Link className="card" to="/admin/announcements">
        <p className="tiny muted">Last announcement</p>
        <p className="h3" style={{ fontSize: 18 }}>{d ? (d.ann?.title ?? 'None yet') : '…'}</p>
        {d?.ann && <p className="tiny muted">{d.ann.push_sent_at ? `Sent to ${d.ann.push_sent_count ?? 0} devices · ${timeAgo(d.ann.push_sent_at)}` : 'Not sent as a notification'}</p>}
      </Link>
      <Link className="card" to={d?.ev ? `/admin/events/${d.ev.id}` : '/admin/events'}>
        <p className="tiny muted">Next event</p>
        <p className="h3" style={{ fontSize: 18 }}>{d ? (d.ev?.title ?? 'None scheduled') : '…'}</p>
        {d?.ev && <p className="tiny muted">{d.ev.n} checked in so far</p>}
      </Link>
    </div>
  );
}

export default function OverviewCards() {
  return <AdminEmbed toast={false}><Inner /></AdminEmbed>;
}
