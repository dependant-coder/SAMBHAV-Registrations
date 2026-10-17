// allow-list.tsx — Admin: Allow-list management (Spec §10.5)
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Pencil, Trash2, Plus, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { normalizeName } from '../../lib/normalize';
import { DOMAINS, DOMAIN_MAP } from '../../config';
import { InfoBox } from '../../components/InfoBox';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import Papa from 'papaparse';

const VALID_ROLES = ['Lead', 'Co-Lead', 'Member'] as const;
type Role = typeof VALID_ROLES[number];

interface AllowedMember {
  id: string;
  domain_slug: string;
  full_name: string;
  name_normalized: string;
  role: string;
  created_at: string;
}

interface MemberRow {
  id: string;
  allowed_member_id: string;
}

interface CsvRow {
  domain_slug: string;
  full_name: string;
  role: string;
}

type CsvRowStatus = 'new' | 'exists' | 'invalid';

interface ParsedCsvRow extends CsvRow {
  status: CsvRowStatus;
  reason?: string;
}

function isSingleWord(name: string): boolean {
  return name.trim().split(/\s+/).length === 1;
}

export function AdminAllowList() {
  const { show } = useToast();
  const [allowed, setAllowed] = useState<AllowedMember[]>([]);
  const [memberMap, setMemberMap] = useState<Map<string, string>>(new Map()); // allowedId → memberId
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  // Add form
  const [addName, setAddName] = useState('');
  const [addDomain, setAddDomain] = useState('');
  const [addRole, setAddRole] = useState<Role>('Member');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [editPendingId, setEditPendingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // CSV import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: am, error: e1 }, { data: mem, error: e2 }] = await Promise.all([
        supabase.from('allowed_members').select('id, domain_slug, full_name, name_normalized, role, created_at').order('full_name'),
        supabase.from('members').select('id, allowed_member_id'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setAllowed((am ?? []) as AllowedMember[]);
      const map = new Map<string, string>();
      for (const m of (mem ?? []) as MemberRow[]) {
        map.set(m.allowed_member_id, m.id);
      }
      setMemberMap(map);
    } catch {
      show('Failed to load allow-list', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const filtered = allowed.filter(m => {
    const matchSearch = !search.trim() || m.full_name.toLowerCase().includes(search.trim().toLowerCase());
    const matchDomain = !domainFilter || m.domain_slug === domainFilter;
    return matchSearch && matchDomain;
  });

  async function handleAdd() {
    setAddError('');
    if (!addName.trim()) { setAddError('Name is required'); return; }
    if (!addDomain) { setAddError('Domain is required'); return; }
    setAddLoading(true);
    try {
      const { error } = await supabase.from('allowed_members').insert({
        domain_slug: addDomain,
        full_name: addName.trim(),
        name_normalized: normalizeName(addName.trim()),
        role: addRole,
      });
      if (error) {
        if (error.code === '23505') {
          setAddError('This person already exists in this domain.');
        } else {
          setAddError(error.message);
        }
        return;
      }
      setAddName(''); setAddDomain(''); setAddRole('Member');
      show('Person added', 'success');
      await load();
    } catch {
      setAddError('Failed to add person');
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(m: AllowedMember) {
    setEditId(m.id);
    setEditName(m.full_name);
    setEditRole(m.role);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setEditRole('');
    setEditPendingId(null);
    setEditConfirmOpen(false);
  }

  async function commitEdit(id: string) {
    setEditLoading(true);
    try {
      const memberId = memberMap.get(id);
      const { error } = await supabase.from('allowed_members').update({
        full_name: editName.trim(),
        name_normalized: normalizeName(editName.trim()),
        role: editRole,
      }).eq('id', id);
      if (error) throw error;
      if (memberId) {
        const { error: e2 } = await supabase.from('members').update({ full_name: editName.trim() }).eq('id', memberId);
        if (e2) throw e2;
      }
      show('Updated', 'success');
      cancelEdit();
      await load();
    } catch {
      show('Failed to update', 'error');
    } finally {
      setEditLoading(false);
    }
  }

  function handleEditSave(id: string) {
    if (memberMap.has(id)) {
      setEditPendingId(id);
      setEditConfirmOpen(true);
    } else {
      commitEdit(id);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError('');
    if (memberMap.has(id)) {
      setDeleteError('Delete their registration first before removing from the allow-list.');
      return;
    }
    try {
      const { error } = await supabase.from('allowed_members').delete().eq('id', id);
      if (error) throw error;
      show('Removed from allow-list', 'success');
      setDeleteId(null);
      await load();
    } catch {
      show('Failed to delete', 'error');
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        const normalizedAllowed = new Set(allowed.map(m => `${m.domain_slug}::${m.name_normalized}`));
        const parsed: ParsedCsvRow[] = result.data.map(row => {
          const domain = (row.domain_slug ?? '').trim();
          const name = (row.full_name ?? '').trim();
          const role = (row.role ?? '').trim();
          if (!name) return { ...row, status: 'invalid', reason: 'Empty name' };
          if (!DOMAIN_MAP[domain]) return { ...row, status: 'invalid', reason: 'Unknown domain' };
          if (!VALID_ROLES.includes(role as Role)) return { ...row, status: 'invalid', reason: 'Invalid role' };
          const key = `${domain}::${normalizeName(name)}`;
          if (normalizedAllowed.has(key)) return { ...row, status: 'exists' };
          return { ...row, status: 'new' };
        });
        setCsvRows(parsed);
      },
    });
  }

  async function handleCsvImport() {
    const newRows = csvRows.filter(r => r.status === 'new');
    if (!newRows.length) return;
    setCsvImporting(true);
    try {
      const inserts = newRows.map(r => ({
        domain_slug: r.domain_slug.trim(),
        full_name: r.full_name.trim(),
        name_normalized: normalizeName(r.full_name.trim()),
        role: r.role.trim(),
      }));
      const { error } = await supabase.from('allowed_members').insert(inserts);
      if (error) throw error;
      show(`Imported ${newRows.length} rows`, 'success');
      setCsvRows([]);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch {
      show('Import failed', 'error');
    } finally {
      setCsvImporting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="loading-spinner" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading allow-list…</span>
      </div>
    );
  }

  const newCsvCount = csvRows.filter(r => r.status === 'new').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="admin-title" style={{ margin: 0 }}>Allow-list</h1>
          <span className="admin-badge admin-badge--sun">{filtered.length} listed</span>
        </div>
        <button className="btn btn--sun btn--sm" onClick={() => setCsvOpen(!csvOpen)}>
          Import CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input
          className="field__input"
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', padding: '0.5rem 0.85rem', fontWeight: 600 }}
        />
        <select
          className="field__input"
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{ flex: '0 1 180px', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', padding: '0.5rem 0.85rem', fontWeight: 600 }}
        >
          <option value="">All domains</option>
          {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
      </div>

      {/* Add person form */}
      <div className="admin-card">
        <h3 className="admin-subtitle">Add person</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 180px', margin: 0 }}>
            <label className="field__label">Full name</label>
            <input className="field__input" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full name" style={{ border: '2px solid var(--ink)', borderRadius: '10px' }} />
          </div>
          <div className="field" style={{ flex: '1 1 140px', margin: 0 }}>
            <label className="field__label">Domain</label>
            <select className="field__input" value={addDomain} onChange={e => setAddDomain(e.target.value)} style={{ border: '2px solid var(--ink)', borderRadius: '10px' }}>
              <option value="">Select domain</option>
              {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 120px', margin: 0 }}>
            <label className="field__label">Role</label>
            <select className="field__input" value={addRole} onChange={e => setAddRole(e.target.value as Role)} style={{ border: '2px solid var(--ink)', borderRadius: '10px' }}>
              {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn btn--sun btn--sm" onClick={handleAdd} disabled={addLoading} style={{ alignSelf: 'flex-end', minHeight: 42 }}>
            <Plus size={14} style={{ marginRight: 4 }} />{addLoading ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="field__error" style={{ marginTop: '0.5rem' }}>{addError}</p>}
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Registered?</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const memberId = memberMap.get(m.id);
              const isEditing = editId === m.id;
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {isEditing ? (
                      <input
                        className="field__input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {m.full_name}
                        {isSingleWord(m.full_name) && (
                          <span title="Single-word name">
                            <AlertTriangle size={14} color="#d97706" />
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span className="badge badge--closed">{DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug}</span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {isEditing ? (
                      <select className="field__input" value={editRole} onChange={e => setEditRole(e.target.value)}>
                        {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${m.role === 'Lead' ? 'badge--approved' : m.role === 'Co-Lead' ? 'badge--open' : 'badge--closed'}`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {memberId ? (
                      <a
                        href="/admin/members"
                        className="link"
                        onClick={e => { e.preventDefault(); window.history.pushState({ filterDomain: m.domain_slug }, '', '/admin/members'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                      >
                        Yes
                      </a>
                    ) : (
                      <span style={{ color: 'var(--muted, #6b7280)' }}>No</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn--primary btn--sm" disabled={editLoading} onClick={() => handleEditSave(m.id)}>
                          <Check size={13} />
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelEdit}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn--ghost btn--sm" title="Edit" onClick={() => startEdit(m)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Delete"
                          onClick={() => { setDeleteId(m.id); setDeleteError(''); }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted, #6b7280)' }}>
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Import */}
      <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <button
          className="btn btn--ghost"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: 0 }}
          onClick={() => setCsvOpen(o => !o)}
        >
          <span>Import CSV</span>
          {csvOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {csvOpen && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border, #e5e7eb)' }}>
            <p className="wizard-step__desc" style={{ marginBottom: '0.75rem' }}>
              Expected columns: <code>domain_slug</code>, <code>full_name</code>, <code>role</code>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFile}
              style={{ marginBottom: '0.75rem' }}
            />
            {csvRows.length > 0 && (
              <>
                <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border, #e5e7eb)' }}>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Domain</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Role</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{row.full_name}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{row.domain_slug}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{row.role}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>
                            {row.status === 'new' && <span className="badge badge--approved">New</span>}
                            {row.status === 'exists' && <span className="badge badge--closed">Already exists</span>}
                            {row.status === 'invalid' && <span className="badge badge--rejected" title={row.reason}>Invalid</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={newCsvCount === 0 || csvImporting}
                  onClick={handleCsvImport}
                >
                  {csvImporting ? 'Importing…' : `Import ${newCsvCount} new row${newCsvCount !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit confirm dialog */}
      <ConfirmDialog
        open={editConfirmOpen}
        title="Update registered member?"
        description="This person has a registration. Renaming them will also update their registration record. Continue?"
        confirmLabel="Yes, update"
        onConfirm={() => {
          setEditConfirmOpen(false);
          if (editPendingId) commitEdit(editPendingId);
        }}
        onCancel={() => { setEditConfirmOpen(false); setEditPendingId(null); }}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteId !== null && !deleteError}
        title="Remove from allow-list?"
        description="This person will no longer be able to register."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Delete blocked error */}
      {deleteId && deleteError && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <InfoBox variant="error">{deleteError}</InfoBox>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => { setDeleteId(null); setDeleteError(''); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
