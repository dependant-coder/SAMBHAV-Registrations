/**
 * src/pages/member/Announcements.tsx   (route /app/announcements)
 * Pinned first, then newest first, 20 per page (keyset on published_at). Filters: All / My domain / Unread.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useReadyMember } from '../../contexts/MemberContext';
import { ANN_COLS, norm } from '../../lib/events';
import type { AnnouncementRow } from '../../lib/events';
import { cacheGet, cacheKey, cacheSet } from '../../lib/cache';
import { fmtDay, timeAgo } from '../../lib/format';
import { Band, Btn, Chip, EmptyState, Ic, ListSkeleton, LoadError, useOnline } from '../../components/member/ui';

const PAGE = 20;
type Filter = 'all' | 'mine' | 'unread';

export default function Announcements() {
  const { member, unread } = useReadyMember();
  const online = useOnline();
  const cKey = cacheKey(member.id, 'ann-list');

  const [filter, setFilter] = useState<Filter>('all');
  const [pinned, setPinned] = useState<AnnouncementRow[]>([]);
  const [items, setItems] = useState<AnnouncementRow[]>(() => cacheGet<AnnouncementRow[]>(cKey) ?? []);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const build = (cursor?: string) => {
    let q = supabase.from('announcements').select(ANN_COLS).eq('pinned', false).order('published_at', { ascending: false }).limit(PAGE + 1);
    if (filter === 'mine' && member.domain_id) q = q.eq('domain_id', member.domain_id);
    if (cursor) q = q.lt('published_at', cursor);
    return q;
  };

  const loadFirst = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      let pq = supabase.from('announcements').select(ANN_COLS).eq('pinned', true).order('published_at', { ascending: false });
      if (filter === 'mine' && member.domain_id) pq = pq.eq('domain_id', member.domain_id);
      const [p, l, r] = await Promise.all([pq, build(), supabase.from('announcement_reads').select('announcement_id')]);
      if (p.error || l.error) throw p.error ?? l.error;
      const rows = ((l.data ?? []) as unknown as AnnouncementRow[]).map(norm);
      setPinned(((p.data ?? []) as unknown as AnnouncementRow[]).map(norm));
      setMore(rows.length > PAGE);
      setItems(rows.slice(0, PAGE));
      setReads(new Set((r.data ?? []).map((x) => x.announcement_id as string)));
      if (filter === 'all') cacheSet(cKey, rows.slice(0, PAGE));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, member.domain_id, cKey]);

  useEffect(() => { void loadFirst(); }, [loadFirst]);
  useEffect(() => {
    const on = () => void loadFirst();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [loadFirst]);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const { data, error: e } = await build(last.published_at);
    setLoadingMore(false);
    if (e) { setError(true); return; }
    const rows = ((data ?? []) as unknown as AnnouncementRow[]).map(norm);
    setMore(rows.length > PAGE);
    setItems((cur) => [...cur, ...rows.slice(0, PAGE)]);
  };

  const all = [...pinned, ...items];
  const shown = filter === 'unread' ? all.filter((a) => !reads.has(a.id)) : all;

  return (
    <section className="screen">
      <Band tone="sun" pb={40} eyebrow="From the core team" title="Updates" />
      <div className="pad" style={{ marginTop: 18 }}>
        <div className="chips" role="group" aria-label="Filter">
          <button className="fchip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
          {member.domain_id && (
            <button className="fchip" aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>My domain</button>
          )}
          <button className="fchip" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
            Unread{unread > 0 ? ` · ${unread}` : ''}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading && all.length === 0 ? <ListSkeleton rows={4} /> :
            error && all.length === 0 ? <LoadError onRetry={() => void loadFirst()} text={online ? "Couldn't load updates." : "You're offline."} /> :
              shown.length === 0 ? (
                <EmptyState
                  title={filter === 'unread' ? "You're all caught up." : 'Nothing new yet.'}
                  text={filter === 'unread' ? 'No unread updates.' : "We'll notify you here."}
                />
              ) : shown.map((a) => {
                const isUnread = !reads.has(a.id);
                return (
                  <Link className="item" key={a.id} to={`/app/announcements/${a.id}`}>
                    <span className={`item__ic ${a.pinned ? 'item__ic--pink' : a.audience === 'domain' ? 'item__ic--blue' : 'item__ic--sun'}`}>
                      <Ic n={a.pinned ? 'pinned' : 'mega'} />
                    </span>
                    <span className="grow">
                      <span className="item__t">{a.title}</span>
                      <span className="item__p">{a.body}</span>
                      <span className="item__m">
                        {a.pinned && <Chip tone="pink" small>Pinned</Chip>}
                        <Chip tone={a.audience === 'domain' ? 'blue' : 'deep'} small>{a.audience === 'domain' ? (a.domain?.name ?? 'Domain') : 'Everyone'}</Chip>
                        {a.pinned ? fmtDay(a.published_at) : timeAgo(a.published_at)}
                      </span>
                    </span>
                    {isUnread && <i className="unread" aria-label="Unread" />}
                  </Link>
                );
              })}
        </div>

        {more && !loading && (
          <Btn tone="line" block style={{ marginTop: 18 }} loading={loadingMore} onClick={loadMore} disabled={!online}>Load more</Btn>
        )}
      </div>
    </section>
  );
}
