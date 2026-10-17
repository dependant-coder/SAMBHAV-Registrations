// pending.tsx — Admin: Pending registrations (Spec §10.3)
import { useEffect, useState, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DOMAINS } from '../../config';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

interface AllowedMember {
  id: string;
  domain_slug: string;
  full_name: string;
  role: string;
}

interface DomainGroup {
  slug: string;
  name: string;
  members: AllowedMember[];
}

function isSingleWord(name: string): boolean {
  return name.trim().split(/\s+/).length === 1;
}

export function AdminPending() {
  const { show } = useToast();
  const [allowedMembers, setAllowedMembers] = useState<AllowedMember[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: allowed, error: e1 }, { data: members, error: e2 }] = await Promise.all([
          supabase.from('allowed_members').select('id, domain_slug, full_name, role'),
          supabase.from('members').select('allowed_member_id'),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setAllowedMembers((allowed ?? []) as AllowedMember[]);
        const ids = new Set<string>(
          (members ?? []).map((m: { allowed_member_id: string }) => m.allowed_member_id)
        );
        setRegisteredIds(ids);
      } catch {
        show('Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [show]);

  const unregistered = useMemo(
    () => allowedMembers.filter(m => !registeredIds.has(m.id)),
    [allowedMembers, registeredIds]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return unregistered;
    const q = search.trim().toLowerCase();
    return unregistered.filter(m => m.full_name.toLowerCase().includes(q));
  }, [unregistered, search]);

  const domainGroups = useMemo<DomainGroup[]>(() => {
    const map = new Map<string, AllowedMember[]>();
    for (const m of filtered) {
      const arr = map.get(m.domain_slug) ?? [];
      arr.push(m);
      map.set(m.domain_slug, arr);
    }
    return DOMAINS
      .filter(d => map.has(d.slug))
      .map(d => ({ slug: d.slug, name: d.name, members: map.get(d.slug)! }));
  }, [filtered]);

  function buildReminderText(group: DomainGroup): string {
    const names = group.members.map(m => m.full_name).join(', ');
    const url = `${window.location.origin}/register/${group.slug}`;
    return `Sambhav 4.0 registration pending (${group.name}): ${names} Please register: ${url}`;
  }

  function copyDomainReminder(group: DomainGroup) {
    navigator.clipboard.writeText(buildReminderText(group)).then(
      () => show(`Copied reminder for ${group.name}`, 'success'),
      () => show('Failed to copy', 'error')
    );
  }

  function copyAllReminders() {
    const text = domainGroups.map(buildReminderText).join('\n');
    navigator.clipboard.writeText(text).then(
      () => show('Copied all reminders', 'success'),
      () => show('Failed to copy', 'error')
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="loading-spinner" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading pending registrations…</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="admin-title" style={{ margin: 0 }}>Pending</h1>
          <span className="admin-badge admin-badge--pink">{unregistered.length} remaining</span>
        </div>
        {domainGroups.length > 0 && (
          <button className="btn btn--sun btn--sm" onClick={copyAllReminders}>
            <Copy size={14} style={{ marginRight: 6 }} />
            Copy all reminders
          </button>
        )}
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <input
          className="field__input"
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontWeight: 600 }}
        />
      </div>

      {domainGroups.length === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={CheckCircle}
            title="Everyone has registered!"
            description="All allowed members have completed their registration."
          />
        </div>
      ) : (
        domainGroups.map(group => (
          <div key={group.slug} className="admin-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>{group.name}</h2>
              <span className="admin-badge admin-badge--sun">{group.members.length}</span>
              <button
                className="btn btn--line btn--sm"
                style={{ marginLeft: 'auto', minHeight: 34, padding: '0 10px', fontSize: '12px' }}
                onClick={() => copyDomainReminder(group)}
              >
                <Copy size={13} style={{ marginRight: 5 }} />
                Copy reminder for {group.name}
              </button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {group.members.map(m => (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{m.full_name}</span>
                  {isSingleWord(m.full_name) && (
                    <span title="Single-word name — may need verification">
                      <AlertTriangle size={15} color="#d97706" />
                    </span>
                  )}
                  <span className={`admin-badge ${m.role === 'Lead' ? 'admin-badge--mint' : m.role === 'Co-Lead' ? 'admin-badge--sun' : 'admin-badge--paper'}`}>
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
