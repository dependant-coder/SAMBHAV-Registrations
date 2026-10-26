/**
 * src/pages/member/AnnouncementDetail.tsx   (route /app/announcements/:id)
 * Body is rendered as PLAIN TEXT (links turned into <a> by our own parser). Never dangerouslySetInnerHTML.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { ANN_COLS, norm } from '../../lib/events';
import type { AnnouncementRow } from '../../lib/events';
import { fmtDateTime, isUuid, linkify, safeHttpUrl, timeAgo } from '../../lib/format';
import { BackBar, Btn, Chip, Ic, ListSkeleton, LoadError, Note } from '../../components/member/ui';

export default function AnnouncementDetail() {
  const { id } = useParams();
  const { member, refreshUnread } = useReadyMember();
  const [row, setRow] = useState<AnnouncementRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'error'>('loading');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!isUuid(id)) { setState('gone'); return; }
    setState('loading');
    (async () => {
      const { data, error } = await supabase.from('announcements').select(ANN_COLS).eq('id', id!).maybeSingle();
      if (!alive) return;
      if (error) { setState('error'); return; }
      if (!data) { setState('gone'); return; }       // expired, deleted or not for this member (RLS returned nothing)
      setRow(norm(data as unknown as AnnouncementRow));
      setState('ok');
      // mark as read: fire and forget, failures are ignored
      void supabase.from('announcement_reads')
        .upsert({ member_id: member.id, announcement_id: id }, { onConflict: 'member_id,announcement_id', ignoreDuplicates: true })
        .then(() => refreshUnread());
    })();
    return () => { alive = false; };
  }, [id, member.id, refreshUnread, tick]);

  const link = safeHttpUrl(row?.link_url);

  return (
    <section className="screen">
      <BackBar to="/app/announcements" label="Updates" />
      <div className="pad">
        {state === 'loading' && <div style={{ marginTop: 16 }}><ListSkeleton rows={2} /></div>}
        {state === 'error' && <div style={{ marginTop: 16 }}><LoadError onRetry={() => setTick((t) => t + 1)} /></div>}
        {state === 'gone' && (
          <div className="stack" style={{ marginTop: 16 }}>
            <Note tone="warn">This announcement isn't available anymore.</Note>
            <Link className="btn btn--ink btn--block" to="/app/announcements">Back to updates</Link>
          </div>
        )}

        {state === 'ok' && row && (
          <>
            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
              <Chip tone={row.audience === 'domain' ? 'blue' : 'deep'}>{row.audience === 'domain' ? (row.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
              <span className="small muted" title={fmtDateTime(row.published_at)}>{timeAgo(row.published_at)}</span>
            </div>
            <h1 className="title-lg">{row.title}</h1>
            <div className="prose">
              <p>
                {linkify(row.body).map((p, i) => p.href
                  ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline', overflowWrap: 'anywhere' }}>{p.t}</a>
                  : <span key={i}>{p.t}</span>)}
              </p>
            </div>
            {link && (
              <a className="btn btn--blue btn--block" style={{ marginTop: 22 }} href={link} target="_blank" rel="noopener noreferrer">
                <Ic n="share" />Open link
              </a>
            )}
            {row.audience === 'domain' && (
              <Note style={{ marginTop: 18 }}>
                Got a question? Reach your lead from <Link className="linkbtn" to="/app/profile">your profile</Link>.
              </Note>
            )}
            <Btn tone="line" block style={{ marginTop: 14 }} onClick={() => history.back()}>Back</Btn>
          </>
        )}
      </div>
    </section>
  );
}
