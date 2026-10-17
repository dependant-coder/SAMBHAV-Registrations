// members.tsx — AdminMembers per spec §10.2
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { photoUrl, uploadPhoto } from '../../lib/api';
import { buildCSV, downloadCSV } from '../../lib/csv';
import { downloadPhotoZip, sanitizeFilename } from '../../lib/zip';
import { formatIST } from '../../lib/dates';
import { normalizePhone, normalizeRoll, isValidPhone, isValidEmail, normalizeName } from '../../lib/normalize';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { InfoBox } from '../../components/InfoBox';
import { EmptyState } from '../../components/EmptyState';
import { PhotoStep } from '../../components/PhotoStep';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../components/Toast';
import { DOMAIN_MAP, DOMAINS, YEAR_LABELS } from '../../config';
import { List, LayoutGrid, Search } from 'lucide-react';

interface Member {
  id: string;
  domain_slug: string;
  full_name: string;
  roll_number: string;
  email: string;
  phone: string;
  alt_phone: string | null;
  year: number;
  branch: string;
  photo_path: string;
  created_at: string;
  role?: string;
}

type DrawerMode = 'view' | 'edit';
type ViewMode = 'table' | 'card';
type SortMode = 'newest' | 'name' | 'domain';

interface ZipProgress {
  doing: boolean;
  done: number;
  total: number;
  skipped: number;
}

export function AdminMembers() {
  const location = useLocation();
  const navigate = useNavigate();
  const { branches } = useApp();
  const { show: showToast } = useToast();

  const initialDomain = (location.state as { filterDomain?: string } | null)?.filterDomain ?? '';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState(initialDomain);
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Drawer
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Edit state
  const [editRoll, setEditRoll] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editPhotoBlob, setEditPhotoBlob] = useState<Blob | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editPhotoMode, setEditPhotoMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ZIP progress
  const [zipProgress, setZipProgress] = useState<ZipProgress>({ doing: false, done: 0, total: 0, skipped: 0 });

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: membersRaw }, { data: allowedRaw }] = await Promise.all([
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('allowed_members').select('domain_slug, full_name, role'),
      ]);

      const roleMap = new Map<string, string>();
      for (const a of allowedRaw ?? []) {
        roleMap.set(`${a.domain_slug}:${normalizeName(a.full_name)}`, a.role ?? 'member');
      }

      const merged: Member[] = (membersRaw ?? []).map((m: Member) => ({
        ...m,
        role: roleMap.get(`${m.domain_slug}:${normalizeName(m.full_name)}`) ?? 'member',
      }));

      setMembers(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Filtered + sorted list
  let filtered = members;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.roll_number.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  }
  if (filterDomain) filtered = filtered.filter(m => m.domain_slug === filterDomain);
  if (filterYear) filtered = filtered.filter(m => m.year === Number(filterYear));
  if (filterBranch) filtered = filtered.filter(m => m.branch === filterBranch);
  if (sort === 'name') filtered = [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name));
  if (sort === 'domain') filtered = [...filtered].sort((a, b) => a.domain_slug.localeCompare(b.domain_slug));

  function openDrawer(m: Member) {
    setSelectedMember(m);
    setDrawerMode('view');
    setEditError(null);
    setEditPhotoMode(false);
    setEditPhotoBlob(null);
    setEditPhotoPreview(null);
  }

  function closeDrawer() {
    setSelectedMember(null);
    setDrawerMode('view');
    setEditError(null);
    setEditPhotoMode(false);
    setEditPhotoBlob(null);
    setEditPhotoPreview(null);
  }

  function startEdit(m: Member) {
    setEditRoll(m.roll_number);
    setEditEmail(m.email);
    setEditPhone(m.phone);
    setEditAltPhone(m.alt_phone ?? '');
    setEditYear(String(m.year));
    setEditBranch(m.branch);
    setEditPhotoBlob(null);
    setEditPhotoPreview(null);
    setEditPhotoMode(false);
    setEditError(null);
    setDrawerMode('edit');
  }

  async function handleSave() {
    if (!selectedMember) return;
    setEditError(null);

    const normPhone = normalizePhone(editPhone);
    const normAlt = editAltPhone ? normalizePhone(editAltPhone) : null;
    const normRoll = normalizeRoll(editRoll);

    if (!normRoll) { setEditError('Roll number is required.'); return; }
    if (!isValidPhone(normPhone)) { setEditError('Enter a valid 10-digit mobile number.'); return; }
    if (normAlt && !isValidPhone(normAlt)) { setEditError('Enter a valid alternate mobile number.'); return; }
    if (!isValidEmail(editEmail)) { setEditError('Enter a valid email address.'); return; }
    if (!editYear) { setEditError('Year is required.'); return; }
    if (!editBranch) { setEditError('Branch is required.'); return; }

    setEditSaving(true);
    try {
      let photoPath = selectedMember.photo_path;
      if (editPhotoBlob) {
        photoPath = await uploadPhoto(editPhotoBlob);
      }

      const { error } = await supabase
        .from('members')
        .update({
          roll_number: normRoll,
          email: editEmail.trim().toLowerCase(),
          phone: normPhone!,
          alt_phone: normAlt,
          year: Number(editYear),
          branch: editBranch,
          photo_path: photoPath,
        })
        .eq('id', selectedMember.id);

      if (error) throw error;

      showToast('Member updated successfully.', 'success');
      await loadMembers();
      // Refresh selected member
      const updated = members.find(m => m.id === selectedMember.id);
      if (updated) {
        setSelectedMember({
          ...updated,
          roll_number: normRoll,
          email: editEmail.trim().toLowerCase(),
          phone: normPhone!,
          alt_phone: normAlt,
          year: Number(editYear),
          branch: editBranch,
          photo_path: photoPath,
        });
      }
      setDrawerMode('view');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedMember || deleting) return;
    const targetMember = selectedMember;
    setDeleting(true);

    try {
      // Delete the member. edit_requests are removed automatically (ON DELETE CASCADE).
      // .select('id') returns the rows that were really deleted, so a silent
      // permission block (no error, zero rows) is detected instead of looking like success.
      const { data: deleted, error: delErr } = await supabase
        .from('members')
        .delete()
        .eq('id', targetMember.id)
        .select('id');
      if (delErr) throw delErr;
      if (!deleted || deleted.length === 0) {
        throw new Error(
          'Nothing was deleted. The database refused the delete (admin delete permission is missing).'
        );
      }

      // Remove the photo only after the database row is really gone (non-blocking)
      if (targetMember.photo_path && !targetMember.photo_path.startsWith('blob:')) {
        try {
          await supabase.storage.from('member-photos').remove([targetMember.photo_path]);
        } catch (photoErr) {
          console.warn('[AdminMembers] Photo removal failed (non-blocking):', photoErr);
        }
      }

      setMembers(prev => prev.filter(m => m.id !== targetMember.id));
      setDeleteOpen(false);
      closeDrawer();
      showToast(`Registration deleted for ${targetMember.full_name}.`, 'success');
      await loadMembers();
    } catch (err) {
      console.error('[AdminMembers] Delete error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Delete failed.';
      showToast(message, 'error'); // dialog stays open so you can read it and retry
    } finally {
      setDeleting(false);
    }
  }

  function handleCopyDetails(m: Member) {
    const text = [
      `Name: ${m.full_name}`,
      `Domain: ${DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug}`,
      `Role: ${m.role ?? 'member'}`,
      `Roll: ${m.roll_number}`,
      `Year: ${YEAR_LABELS[m.year] ?? m.year}`,
      `Branch: ${m.branch}`,
      `Mobile: ${m.phone}`,
      m.alt_phone ? `Alt Mobile: ${m.alt_phone}` : null,
      `Email: ${m.email}`,
      `Registered: ${formatIST(m.created_at)}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast('Details copied to clipboard.', 'success');
  }

  function handleExportCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const domainLabel = filterDomain || 'all';
    const filename = `sambhav4_members_${domainLabel}_${today}.csv`;
    const columns = ['Domain', 'Role', 'Name', 'Year', 'Branch', 'Roll No', 'Mobile', 'Alternate Mobile', 'Email', 'Photo URL', 'Registered At'];
    const rows = filtered.map(m => ({
      'Domain': DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug,
      'Role': m.role ?? 'member',
      'Name': m.full_name,
      'Year': YEAR_LABELS[m.year] ?? String(m.year),
      'Branch': m.branch,
      'Roll No': m.roll_number,
      'Mobile': m.phone,
      'Alternate Mobile': m.alt_phone ?? '',
      'Email': m.email,
      'Photo URL': photoUrl(m.photo_path),
      'Registered At': formatIST(m.created_at),
    }));
    downloadCSV(buildCSV(rows, columns), filename);
  }

  async function handleDownloadZip() {
    const entries = filtered.map(m => ({
      filename: sanitizeFilename(`${m.domain_slug}_${m.full_name}_${m.roll_number}`) + '.jpg',
      url: photoUrl(m.photo_path),
    }));
    const zipName = `sambhav4_photos_${filterDomain || 'all'}_${new Date().toISOString().slice(0, 10)}.zip`;

    setZipProgress({ doing: true, done: 0, total: entries.length, skipped: 0 });
    try {
      const { skipped } = await downloadPhotoZip(entries, zipName, (done, total) => {
        setZipProgress(prev => ({ ...prev, done, total }));
      });
      setZipProgress({ doing: false, done: entries.length, total: entries.length, skipped });
      if (skipped > 0) {
        showToast(`ZIP downloaded. ${skipped} photo(s) couldn't be fetched.`, 'warning');
      } else {
        showToast('Photos ZIP downloaded.', 'success');
      }
    } catch (err) {
      setZipProgress({ doing: false, done: 0, total: 0, skipped: 0 });
      showToast(err instanceof Error ? err.message : 'ZIP download failed.', 'error');
    }
  }

  const branchOptions = branches.map(b => b.name);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="admin-title" style={{ margin: 0 }}>Members</h1>
          <span className="admin-badge admin-badge--sun">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--sun btn--sm" onClick={handleExportCSV}>
            Export CSV
          </button>
          <button type="button" className="btn btn--line btn--sm" onClick={handleDownloadZip} disabled={zipProgress.doing}>
            {zipProgress.doing ? `Zipping… ${zipProgress.done}/${zipProgress.total}` : 'Download Photos (ZIP)'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search name, roll, email, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontSize: '0.875rem', fontWeight: 600 }}
        />
        <select
          value={filterDomain}
          onChange={e => setFilterDomain(e.target.value)}
          style={{ padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <option value="">All domains</option>
          {DOMAINS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          style={{ padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <option value="">All years</option>
          {[1, 2, 3, 4].map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
        </select>
        <select
          value={filterBranch}
          onChange={e => setFilterBranch(e.target.value)}
          style={{ padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <option value="">All branches</option>
          {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortMode)}
          style={{ padding: '0.5rem 0.85rem', border: '2px solid var(--ink)', borderRadius: '12px', background: 'var(--white)', color: 'var(--ink)', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="domain">Domain</option>
        </select>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            className={`btn btn--sm ${viewMode === 'table' ? 'btn--sun' : 'btn--ghost'}`}
            onClick={() => setViewMode('table')}
            title="Table view"
            style={{ minHeight: 38, padding: '0 12px' }}
          >
            <List size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`btn btn--sm ${viewMode === 'card' ? 'btn--sun' : 'btn--ghost'}`}
            onClick={() => setViewMode('card')}
            title="Card view"
            style={{ minHeight: 38, padding: '0 12px' }}
          >
            <LayoutGrid size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
          <div className="loading-spinner" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading members roster…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No members found" description="Try adjusting your filters." />
      ) : viewMode === 'table' ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {['Photo', 'Name', 'Domain', 'Year', 'Branch', 'Roll', 'Mobile', 'Alt Mobile', 'Email', 'Registered'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr
                  key={m.id}
                  onClick={() => openDrawer(m)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <img src={photoUrl(m.photo_path)} alt={m.full_name} style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--ink)', objectFit: 'cover', display: 'block', background: 'var(--paper)' }} loading="lazy" />
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{m.full_name}</div>
                    {m.role && m.role !== 'member' && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px', color: 'var(--color-text-secondary)' }}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{YEAR_LABELS[m.year] ?? m.year}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{m.branch}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{m.roll_number}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{m.phone}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{m.alt_phone ?? '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{m.email}</td>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>{formatIST(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => openDrawer(m)}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <img src={photoUrl(m.photo_path)} alt={m.full_name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} loading="lazy" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{m.roll_number}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{formatIST(m.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Drawer backdrop */}
      {selectedMember && (
        <div
          onClick={closeDrawer}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199,
          }}
        />
      )}

      {/* Side drawer */}
      {selectedMember && (
        <div
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 'min(420px, 100vw)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 200,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drawer header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {drawerMode === 'edit' ? 'Edit Member' : 'Member Details'}
            </span>
            <button type="button" onClick={closeDrawer} className="btn btn--ghost btn--sm" aria-label="Close">✕</button>
          </div>

          <div style={{ flex: 1, padding: '1.25rem' }}>
            {drawerMode === 'view' ? (
              <ViewPane
                member={selectedMember}
                onEdit={() => startEdit(selectedMember)}
                onDelete={() => setDeleteOpen(true)}
                onCopy={() => handleCopyDetails(selectedMember)}
                navigate={navigate}
              />
            ) : (
              <EditPane
                member={selectedMember}
                editRoll={editRoll} setEditRoll={setEditRoll}
                editEmail={editEmail} setEditEmail={setEditEmail}
                editPhone={editPhone} setEditPhone={setEditPhone}
                editAltPhone={editAltPhone} setEditAltPhone={setEditAltPhone}
                editYear={editYear} setEditYear={setEditYear}
                editBranch={editBranch} setEditBranch={setEditBranch}
                editPhotoBlob={editPhotoBlob}
                editPhotoPreview={editPhotoPreview}
                editPhotoMode={editPhotoMode}
                setEditPhotoMode={setEditPhotoMode}
                onPhotoNext={(blob, preview) => {
                  setEditPhotoBlob(blob);
                  setEditPhotoPreview(preview);
                  setEditPhotoMode(false);
                }}
                editError={editError}
                editSaving={editSaving}
                branchOptions={branchOptions}
                onSave={handleSave}
                onCancel={() => setDrawerMode('view')}
              />
            )}
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete registration"
        description={
          <div>
            <p>Delete <strong>{selectedMember?.full_name}</strong>'s registration? The roster slot will become free so they (or the real person) can register again.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Note: The photo will also be deleted from storage.</p>
          </div>
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        variant="danger"
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteOpen(false); }}
      />

      {/* ZIP progress modal */}
      {zipProgress.doing && (
        <div className="dialog-overlay">
          <div className="dialog" style={{ maxWidth: 360 }}>
            <h2 className="dialog__title">Building ZIP…</h2>
            <div className="dialog__body">
              <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                Downloading {zipProgress.done} of {zipProgress.total} photos…
              </p>
              <progress value={zipProgress.done} max={zipProgress.total} style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components --------------------------------------------------------

interface ViewPaneProps {
  member: Member;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

function ViewPane({ member: m, onEdit, onDelete, onCopy }: ViewPaneProps) {
  const cfg = DOMAIN_MAP[m.domain_slug];
  return (
    <div>
      {/* Photo */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <img
          src={photoUrl(m.photo_path)}
          alt={m.full_name}
          style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-border)' }}
        />
      </div>

      {/* Name + badges */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.4rem' }}>{m.full_name}</div>
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: cfg?.color ?? 'var(--color-primary)', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
            {cfg?.name ?? m.domain_slug}
          </span>
          {m.role && (
            <span style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {m.role}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        {[
          ['Roll', m.roll_number],
          ['Year', YEAR_LABELS[m.year] ?? m.year],
          ['Branch', m.branch],
          ['Mobile', m.phone],
          ['Alt Mobile', m.alt_phone ?? '—'],
          ['Email', m.email],
          ['Registered', formatIST(m.created_at)],
        ].map(([label, value]) => (
          <>
            <dt key={`dt-${label}`} style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</dt>
            <dd key={`dd-${label}`} style={{ margin: 0, wordBreak: 'break-all' }}>{value}</dd>
          </>
        ))}
      </dl>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCopy}>Copy details</button>
        <a href={`tel:+91${m.phone}`} className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>Call</a>
        <a href={`https://wa.me/91${m.phone}`} target="_blank" rel="noopener noreferrer" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>WhatsApp</a>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onEdit}>Edit</button>
        <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

interface EditPaneProps {
  member: Member;
  editRoll: string; setEditRoll: (v: string) => void;
  editEmail: string; setEditEmail: (v: string) => void;
  editPhone: string; setEditPhone: (v: string) => void;
  editAltPhone: string; setEditAltPhone: (v: string) => void;
  editYear: string; setEditYear: (v: string) => void;
  editBranch: string; setEditBranch: (v: string) => void;
  editPhotoBlob: Blob | null;
  editPhotoPreview: string | null;
  editPhotoMode: boolean;
  setEditPhotoMode: (v: boolean) => void;
  onPhotoNext: (blob: Blob, preview: string) => void;
  editError: string | null;
  editSaving: boolean;
  branchOptions: string[];
  onSave: () => void;
  onCancel: () => void;
}

function EditPane({
  member: m,
  editRoll, setEditRoll,
  editEmail, setEditEmail,
  editPhone, setEditPhone,
  editAltPhone, setEditAltPhone,
  editYear, setEditYear,
  editBranch, setEditBranch,
  editPhotoBlob,
  editPhotoPreview,
  editPhotoMode,
  setEditPhotoMode,
  onPhotoNext,
  editError,
  editSaving,
  branchOptions,
  onSave,
  onCancel,
}: EditPaneProps) {
  if (editPhotoMode) {
    return (
      <PhotoStep
        onNext={onPhotoNext}
        onBack={() => setEditPhotoMode(false)}
        existingBlob={editPhotoBlob}
        existingPreviewUrl={editPhotoPreview}
      />
    );
  }

  const currentPhoto = editPhotoPreview ?? photoUrl(m.photo_path);

  return (
    <div>
      {/* Read-only fields */}
      <div className="field" style={{ marginBottom: '0.75rem' }}>
        <span className="field__label">Full Name</span>
        <div style={{ padding: '0.4rem 0', fontSize: '0.875rem', color: 'var(--color-text)' }}>{m.full_name}</div>
        <span className="field__hint">Use Allow-list to rename.</span>
      </div>
      <div className="field" style={{ marginBottom: '0.75rem' }}>
        <span className="field__label">Domain</span>
        <div style={{ padding: '0.4rem 0', fontSize: '0.875rem', color: 'var(--color-text)' }}>{DOMAIN_MAP[m.domain_slug]?.name ?? m.domain_slug}</div>
      </div>

      {/* Photo */}
      <div className="field" style={{ marginBottom: '0.75rem' }}>
        <span className="field__label">Photo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          <img src={currentPhoto} alt="Current photo" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }} />
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditPhotoMode(true)}>
            Change photo
          </button>
        </div>
      </div>

      {/* Editable fields */}
      {[
        { label: 'Roll Number', value: editRoll, setter: setEditRoll, type: 'text' },
        { label: 'Email', value: editEmail, setter: setEditEmail, type: 'email' },
        { label: 'Mobile', value: editPhone, setter: setEditPhone, type: 'tel' },
        { label: 'Alt Mobile', value: editAltPhone, setter: setEditAltPhone, type: 'tel' },
      ].map(({ label, value, setter, type }) => (
        <div key={label} className="field" style={{ marginBottom: '0.75rem' }}>
          <label className="field__label">{label}</label>
          <input
            type={type}
            className="field__input"
            value={value}
            onChange={e => setter(e.target.value)}
            disabled={editSaving}
          />
        </div>
      ))}

      <div className="field" style={{ marginBottom: '0.75rem' }}>
        <label className="field__label">Year</label>
        <select
          className="field__input"
          value={editYear}
          onChange={e => setEditYear(e.target.value)}
          disabled={editSaving}
        >
          <option value="">Select year</option>
          {[1, 2, 3, 4].map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
        </select>
      </div>

      <div className="field" style={{ marginBottom: '1rem' }}>
        <label className="field__label">Branch</label>
        <select
          className="field__input"
          value={editBranch}
          onChange={e => setEditBranch(e.target.value)}
          disabled={editSaving}
        >
          <option value="">Select branch</option>
          {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {editError && (
        <InfoBox variant="error" className="mb-4">
          {editError}
        </InfoBox>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={onSave} disabled={editSaving}>
          {editSaving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={editSaving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
