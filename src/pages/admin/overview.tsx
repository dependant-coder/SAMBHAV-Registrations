// overview.tsx — AdminOverview per spec §10.1
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { photoUrl } from '../../lib/api';
import { formatIST } from '../../lib/dates';
import { useApp } from '../../contexts/AppContext';
import { DOMAIN_MAP, DOMAINS } from '../../config';
import { Inbox, Clipboard } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { getDomainIcon } from '../../lib/domainIcons';

interface RecentMember {
  id: string;
  full_name: string;
  domain_slug: string;
  photo_path: string;
  created_at: string;
}

interface DomainCount {
  slug: string;
  registered: number;
  allowed: number;
}

export function AdminOverview() {
  const navigate = useNavigate();
  const { settings } = useApp();

  const [membersCount, setMembersCount] = useState<number>(0);
  const [allowedCount, setAllowedCount] = useState<number>(0);
  const [domainCounts, setDomainCounts] = useState<DomainCount[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [recent, setRecent] = useState<RecentMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [
          { count: mCount },
          { count: aCount },
          { data: membersByDomain },
          { data: allowedByDomain },
          { count: pCount },
          { data: recentData },
        ] = await Promise.all([
          supabase.from('members').select('*', { count: 'exact', head: true }),
          supabase.from('allowed_members').select('*', { count: 'exact', head: true }),
          supabase.from('members').select('domain_slug'),
          supabase.from('allowed_members').select('domain_slug'),
          supabase.from('edit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('members')
            .select('id, full_name, domain_slug, photo_path, created_at')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (cancelled) return;

        setMembersCount(mCount ?? 0);
        setAllowedCount(aCount ?? 0);
        setPendingCount(pCount ?? 0);
        setRecent((recentData ?? []) as RecentMember[]);

        // Build per-domain counts
        const regMap = new Map<string, number>();
        for (const m of membersByDomain ?? []) {
          regMap.set(m.domain_slug, (regMap.get(m.domain_slug) ?? 0) + 1);
        }
        const allowMap = new Map<string, number>();
        for (const a of allowedByDomain ?? []) {
          allowMap.set(a.domain_slug, (allowMap.get(a.domain_slug) ?? 0) + 1);
        }

        setDomainCounts(
          DOMAINS.map(d => ({
            slug: d.slug,
            registered: regMap.get(d.slug) ?? 0,
            allowed: allowMap.get(d.slug) ?? 0,
          }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const pct = allowedCount > 0 ? Math.round((membersCount / allowedCount) * 100) : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="loading-spinner" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading overview…</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-title">Overview</h1>

      {/* Big progress bar card */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.65rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>Total Registrations</span>
          <span className="admin-badge admin-badge--sun" style={{ fontSize: '1rem', padding: '4px 12px' }}>
            {membersCount} / {allowedCount}
          </span>
        </div>
        <div style={{ background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 999, height: 16, overflow: 'hidden', padding: 2 }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--blue)',
              borderRadius: 999,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
          {pct}% of roster registered
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Pending edit requests */}
        <button
          type="button"
          onClick={() => navigate('/admin/edit-requests')}
          className="admin-card"
          style={{ cursor: 'pointer', textAlign: 'left', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="admin-subtitle">Open Edit Requests</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: pendingCount > 0 ? 'var(--pink)' : 'var(--ink)' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--blue)', marginTop: '0.4rem' }}>
            View requests →
          </div>
        </button>

        {/* Registration status */}
        <div className="admin-card">
          <div className="admin-subtitle">Registration Status</div>
          <div style={{ margin: '0.5rem 0' }}>
            <span
              className={`admin-badge ${settings?.registration_open ? 'admin-badge--mint' : 'admin-badge--pink'}`}
              style={{ fontSize: '0.9rem', padding: '4px 12px' }}
            >
              {settings?.registration_open ? 'Open' : 'Closed'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/settings')}
            style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Change in Settings →
          </button>
        </div>

        {/* Roster size */}
        <div className="admin-card">
          <div className="admin-subtitle">Roster Size</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--ink)' }}>
            {allowedCount}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-soft)', marginTop: '0.2rem' }}>
            allowed members
          </div>
        </div>
      </div>

      {/* Per-domain breakdown */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '2px solid var(--ink)', fontWeight: 800, fontSize: '0.95rem', background: 'rgba(20,18,58,0.04)' }}>
          By Domain
        </div>
        {domainCounts.map(dc => {
          const cfg = DOMAIN_MAP[dc.slug];
          const domPct = dc.allowed > 0 ? Math.round((dc.registered / dc.allowed) * 100) : 0;
          return (
            <button
              key={dc.slug}
              type="button"
              onClick={() => navigate('/admin/members', { state: { filterDomain: dc.slug } })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgba(20,18,58,0.1)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {(() => { const Icon = cfg ? getDomainIcon(cfg.icon) : Clipboard; return (
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--sun)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0 }} aria-hidden="true">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
              ); })()}
              <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>
                {cfg?.name ?? dc.slug}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)', minWidth: 50, textAlign: 'right' }}>
                {dc.registered}/{dc.allowed}
              </span>
              <div style={{ width: 80, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 999, height: 10, overflow: 'hidden', marginLeft: '0.5rem' }}>
                <div
                  style={{
                    width: `${domPct}%`,
                    height: '100%',
                    background: 'var(--mint)',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent registrations */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '2px solid var(--ink)', fontWeight: 800, fontSize: '0.95rem', background: 'rgba(20,18,58,0.04)' }}>
          Recent Registrations
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '2rem' }}>
            <EmptyState icon={Inbox} title="No registrations yet" description="Members who register will appear here." />
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recent.map(m => {
              const cfg = DOMAIN_MAP[m.domain_slug];
              return (
                <li
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid rgba(20,18,58,0.1)',
                  }}
                >
                  <img
                    src={photoUrl(m.photo_path)}
                    alt={m.full_name}
                    style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--ink)', objectFit: 'cover', flexShrink: 0, background: 'var(--paper)' }}
                    loading="lazy"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>
                      {m.full_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-soft)' }}>
                      {cfg?.name ?? m.domain_slug}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                    {formatIST(m.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
