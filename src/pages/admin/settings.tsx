// settings.tsx — Admin: Settings (Spec §10.6 + §19)
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminListOrphanPhotos, photoUrl, fetchSettings, fetchBranches, type Settings, type Branch } from '../../lib/api';
import { formatIST } from '../../lib/dates';
import { InfoBox } from '../../components/InfoBox';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

// IST offset: UTC+5:30
function toISTInputValue(utcStr: string | null): string {
  if (!utcStr) return '';
  return new Date(new Date(utcStr).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function fromISTInputValue(localStr: string): string {
  return new Date(new Date(localStr).getTime() - 5.5 * 60 * 60 * 1000).toISOString();
}

interface OrphanPhoto {
  name: string;
  created_at: string;
}

export function AdminSettings() {
  const { show } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [admins, setAdmins] = useState<{ user_id: string; email: string; created_at: string }[]>([]);

  // Section A: Registration
  const [regOpen, setRegOpen] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [regSaving, setRegSaving] = useState(false);

  // Section B: Edit window
  const [editHours, setEditHours] = useState(24);
  const [editHoursSaving, setEditHoursSaving] = useState(false);

  // Section C: Help contact
  const [helpName, setHelpName] = useState('');
  const [helpPhone, setHelpPhone] = useState('');
  const [helpWhatsapp, setHelpWhatsapp] = useState('');
  const [helpEmail, setHelpEmail] = useState('');
  const [helpSaving, setHelpSaving] = useState(false);

  // Section D: Roll regex
  const [rollRegex, setRollRegex] = useState('');
  const [rollTest, setRollTest] = useState('');
  const [rollError, setRollError] = useState('');
  const [rollSaving, setRollSaving] = useState(false);

  // Section E: Branches
  const [newBranchName, setNewBranchName] = useState('');
  const [branchAddLoading, setBranchAddLoading] = useState(false);
  const [editBranchId, setEditBranchId] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [deleteBranchName, setDeleteBranchName] = useState<string | null>(null);
  const [deleteBranchError, setDeleteBranchError] = useState('');

  // Section G: Orphan photos
  const [orphans, setOrphans] = useState<OrphanPhoto[]>([]);
  const [orphanSelected, setOrphanSelected] = useState<Set<string>>(new Set());
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanDeleting, setOrphanDeleting] = useState(false);
  const [orphanSearched, setOrphanSearched] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const [s, b, { data: adminData }] = await Promise.all([
        fetchSettings(),
        fetchBranches(),
        supabase.from('admins').select('user_id, email, created_at').order('created_at'),
      ]);
      setSettings(s);
      setBranches(b);
      setAdmins((adminData ?? []) as { user_id: string; email: string; created_at: string }[]);
      // Populate form fields
      setRegOpen(s.registration_open);
      setDeadline(toISTInputValue(s.registration_deadline));
      setEditHours(s.edit_window_hours);
      setHelpName(s.help_name ?? '');
      setHelpPhone(s.help_phone ?? '');
      setHelpWhatsapp(s.help_whatsapp_url ?? '');
      setHelpEmail(s.help_email ?? '');
      setRollRegex(s.roll_regex ?? '');
    } catch {
      show('Failed to load settings', 'error');
    } finally {
      setLoadingSettings(false);
    }
  }, [show]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Section A: Save registration toggle + deadline
  async function saveRegistration() {
    setRegSaving(true);
    try {
      const deadlineUtc = deadline ? fromISTInputValue(deadline) : null;
      const { error } = await supabase.from('settings').update({
        registration_open: regOpen,
        registration_deadline: deadlineUtc,
      }).eq('fest_name', settings?.fest_name ?? '');
      if (error) throw error;
      show('Registration settings saved', 'success');
      await loadAll();
    } catch {
      show('Failed to save', 'error');
    } finally {
      setRegSaving(false);
    }
  }

  // Section B: Save edit window
  async function saveEditWindow() {
    setEditHoursSaving(true);
    try {
      const { error } = await supabase.from('settings').update({ edit_window_hours: editHours }).eq('fest_name', settings?.fest_name ?? '');
      if (error) throw error;
      show('Edit window saved', 'success');
    } catch {
      show('Failed to save', 'error');
    } finally {
      setEditHoursSaving(false);
    }
  }

  // Section C: Save help contact
  async function saveHelp() {
    setHelpSaving(true);
    try {
      const { error } = await supabase.from('settings').update({
        help_name: helpName || null,
        help_phone: helpPhone || null,
        help_whatsapp_url: helpWhatsapp || null,
        help_email: helpEmail || null,
      }).eq('fest_name', settings?.fest_name ?? '');
      if (error) throw error;
      show('Help contact saved', 'success');
    } catch {
      show('Failed to save', 'error');
    } finally {
      setHelpSaving(false);
    }
  }

  // Section D: Save roll regex
  async function saveRollRegex() {
    setRollError('');
    if (!rollRegex.trim()) { setRollError('Pattern cannot be empty.'); return; }
    try { new RegExp(rollRegex); } catch {
      setRollError('Invalid regular expression — fix it before saving.');
      return;
    }
    setRollSaving(true);
    try {
      const { error } = await supabase.from('settings').update({ roll_regex: rollRegex }).eq('fest_name', settings?.fest_name ?? '');
      if (error) throw error;
      show('Roll number pattern saved', 'success');
    } catch {
      show('Failed to save', 'error');
    } finally {
      setRollSaving(false);
    }
  }

  function rollTestResult(): 'match' | 'no-match' | 'invalid' | 'empty' {
    if (!rollRegex.trim()) return 'empty';
    if (!rollTest) return 'empty';
    try {
      return new RegExp(rollRegex).test(rollTest) ? 'match' : 'no-match';
    } catch {
      return 'invalid';
    }
  }

  // Section E: Branches
  async function addBranch() {
    if (!newBranchName.trim()) return;
    setBranchAddLoading(true);
    try {
      const maxOrder = branches.reduce((m, b) => Math.max(m, b.sort_order), 0);
      const { error } = await supabase.from('branches').insert({ name: newBranchName.trim(), sort_order: maxOrder + 1 });
      if (error) throw error;
      setNewBranchName('');
      show('Branch added', 'success');
      const b = await fetchBranches();
      setBranches(b);
    } catch {
      show('Failed to add branch', 'error');
    } finally {
      setBranchAddLoading(false);
    }
  }

  async function renameBranch(oldName: string) {
    if (!editBranchName.trim()) return;
    try {
      const { error } = await supabase.from('branches').update({ name: editBranchName.trim() }).eq('name', oldName);
      if (error) throw error;
      setEditBranchId(null);
      show('Branch renamed', 'success');
      const b = await fetchBranches();
      setBranches(b);
    } catch {
      show('Failed to rename', 'error');
    }
  }

  async function deleteBranch(name: string) {
    setDeleteBranchError('');
    try {
      const { count, error: ce } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('branch', name);
      if (ce) throw ce;
      if ((count ?? 0) > 0) {
        setDeleteBranchError(`${count} member${count !== 1 ? 's' : ''} use this branch. Reassign them first.`);
        return;
      }
      const { error } = await supabase.from('branches').delete().eq('name', name);
      if (error) throw error;
      setDeleteBranchName(null);
      show('Branch deleted', 'success');
      const b = await fetchBranches();
      setBranches(b);
    } catch {
      show('Failed to delete branch', 'error');
    }
  }

  async function swapBranchOrder(indexA: number, indexB: number) {
    const a = branches[indexA];
    const b = branches[indexB];
    try {
      await Promise.all([
        supabase.from('branches').update({ sort_order: b.sort_order }).eq('name', a.name),
        supabase.from('branches').update({ sort_order: a.sort_order }).eq('name', b.name),
      ]);
      const updated = await fetchBranches();
      setBranches(updated);
    } catch {
      show('Failed to reorder', 'error');
    }
  }

  // Section G: Orphan photos
  async function findOrphans() {
    setOrphanLoading(true);
    setOrphanSearched(true);
    try {
      const list = await adminListOrphanPhotos();
      setOrphans(list);
      setOrphanSelected(new Set());
    } catch {
      show('Failed to find orphans', 'error');
    } finally {
      setOrphanLoading(false);
    }
  }

  async function deleteSelectedOrphans() {
    const names = Array.from(orphanSelected);
    if (!names.length) return;
    setOrphanDeleting(true);
    try {
      const { error } = await supabase.storage.from('member-photos').remove(names);
      if (error) throw error;
      show(`Deleted ${names.length} photo${names.length !== 1 ? 's' : ''}`, 'success');
      setOrphans(prev => prev.filter(o => !orphanSelected.has(o.name)));
      setOrphanSelected(new Set());
    } catch {
      show('Failed to delete photos', 'error');
    } finally {
      setOrphanDeleting(false);
    }
  }

  if (loadingSettings) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="loading-spinner" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading settings…</span>
      </div>
    );
  }

  const testResult = rollTestResult();

  return (
    <div>
      <h1 className="admin-title">Settings</h1>

      {/* A. Registration */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Registration</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
            <input type="checkbox" checked={regOpen} onChange={e => setRegOpen(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} />
            Registration is {regOpen ? 'Open' : 'Closed'}
          </label>
        </div>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label className="field__label">Deadline (IST)</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="field__input"
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={{ flex: 1, border: '2px solid var(--ink)', borderRadius: '10px' }}
            />
            {deadline && (
              <button className="btn btn--ghost btn--sm" onClick={() => setDeadline('')}>Clear</button>
            )}
          </div>
        </div>
        <button className="btn btn--sun btn--sm" onClick={saveRegistration} disabled={regSaving}>
          {regSaving ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* B. Edit window */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Edit window</h2>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label className="field__label">Window duration (hours)</label>
          <input
            className="field__input"
            type="number"
            min={1}
            max={336}
            value={editHours}
            onChange={e => setEditHours(Number(e.target.value))}
            style={{ maxWidth: 120, border: '2px solid var(--ink)', borderRadius: '10px' }}
          />
        </div>
        <button className="btn btn--sun btn--sm" onClick={saveEditWindow} disabled={editHoursSaving}>
          {editHoursSaving ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* C. Help contact */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Help contact</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Name</label>
            <input className="field__input" value={helpName} onChange={e => setHelpName(e.target.value)} placeholder="Contact name" style={{ border: '2px solid var(--ink)', borderRadius: '10px' }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Phone</label>
            <input className="field__input" value={helpPhone} onChange={e => setHelpPhone(e.target.value)} placeholder="10-digit number" style={{ border: '2px solid var(--ink)', borderRadius: '10px' }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">WhatsApp URL</label>
            <input className="field__input" value={helpWhatsapp} onChange={e => setHelpWhatsapp(e.target.value)} placeholder="https://wa.me/91..." style={{ border: '2px solid var(--ink)', borderRadius: '10px' }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Email</label>
            <input className="field__input" type="email" value={helpEmail} onChange={e => setHelpEmail(e.target.value)} placeholder="help@example.com" style={{ border: '2px solid var(--ink)', borderRadius: '10px' }} />
          </div>
        </div>
        <button className="btn btn--sun btn--sm" onClick={saveHelp} disabled={helpSaving}>
          {helpSaving ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* D. Roll number pattern */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Roll number pattern</h2>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label className="field__label">Regex pattern</label>
          <input
            className="field__input"
            value={rollRegex}
            onChange={e => { setRollRegex(e.target.value); setRollError(''); }}
            placeholder="e.g. ^[0-9]{2}[A-Z]{2}[0-9]{3}$"
            style={{ fontFamily: 'monospace', border: '2px solid var(--ink)', borderRadius: '10px' }}
          />
          {rollError && <p className="field__error">{rollError}</p>}
        </div>
        <div className="field" style={{ marginBottom: '0.85rem' }}>
          <label className="field__label">Test a roll number</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              className="field__input"
              value={rollTest}
              onChange={e => setRollTest(e.target.value)}
              placeholder="Type a roll number to test…"
              style={{ flex: 1, border: '2px solid var(--ink)', borderRadius: '10px' }}
            />
            {rollTest && testResult === 'match' && <CheckCircle size={18} color="#16a34a" />}
            {rollTest && testResult === 'no-match' && <XCircle size={18} color="#dc2626" />}
            {rollTest && testResult === 'invalid' && (
              <span title="Invalid regex">
                <XCircle size={18} color="#d97706" />
              </span>
            )}
          </div>
        </div>
        <button className="btn btn--sun btn--sm" onClick={saveRollRegex} disabled={rollSaving}>
          {rollSaving ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* E. Branches */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Branches</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {branches.map((b, i) => (
            <li key={b.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 10 }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>
                {editBranchId === b.name ? (
                  <input
                    className="field__input"
                    value={editBranchName}
                    onChange={e => setEditBranchName(e.target.value)}
                    style={{ width: '100%', border: '2px solid var(--ink)', borderRadius: 6 }}
                    onKeyDown={e => { if (e.key === 'Enter') renameBranch(b.name); if (e.key === 'Escape') setEditBranchId(null); }}
                    autoFocus
                  />
                ) : (
                  b.name
                )}
              </span>
              <span className="admin-badge admin-badge--sun">#{b.sort_order}</span>
              {editBranchId === b.name ? (
                <>
                  <button className="btn btn--primary btn--sm" onClick={() => renameBranch(b.name)}>Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditBranchId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn btn--ghost btn--sm" title="Rename" onClick={() => { setEditBranchId(b.name); setEditBranchName(b.name); }}>
                    <span style={{ fontSize: '0.75rem' }}>Rename</span>
                  </button>
                  <button className="btn btn--ghost btn--sm" disabled={i === 0} onClick={() => swapBranchOrder(i, i - 1)} title="Move up">
                    <ChevronUp size={14} />
                  </button>
                  <button className="btn btn--ghost btn--sm" disabled={i === branches.length - 1} onClick={() => swapBranchOrder(i, i + 1)} title="Move down">
                    <ChevronDown size={14} />
                  </button>
                  <button className="btn btn--ghost btn--sm" title="Delete" onClick={() => { setDeleteBranchName(b.name); setDeleteBranchError(''); }}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            className="field__input"
            value={newBranchName}
            onChange={e => setNewBranchName(e.target.value)}
            placeholder="New branch name"
            style={{ flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') addBranch(); }}
          />
          <button className="btn btn--primary btn--sm" onClick={addBranch} disabled={branchAddLoading || !newBranchName.trim()}>
            <Plus size={14} style={{ marginRight: 4 }} />{branchAddLoading ? 'Adding…' : 'Add'}
          </button>
        </div>
        {deleteBranchError && (
          <div style={{ marginTop: '0.75rem' }}>
            <InfoBox variant="error">{deleteBranchError}</InfoBox>
          </div>
        )}
      </section>

      {/* F. Admins */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Admins</h2>
        <InfoBox variant="info" style={{ marginBottom: '1rem' }}>
          To add or remove admins, go to the Supabase dashboard → Authentication → Users, then add/remove their email from the <code>admins</code> table.
        </InfoBox>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {admins.map(a => (
            <li key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 10 }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>{a.email}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-soft)' }}>{formatIST(a.created_at)}</span>
            </li>
          ))}
          {admins.length === 0 && <li style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', fontWeight: 600 }}>No admins found</li>}
        </ul>
      </section>

      {/* G. Orphan photos */}
      <section className="admin-card">
        <h2 className="admin-subtitle">Maintenance — Orphan photos</h2>
        <button className="btn btn--line btn--sm" onClick={findOrphans} disabled={orphanLoading} style={{ marginBottom: '1rem' }}>
          {orphanLoading ? 'Searching…' : 'Find unused photos'}
        </button>
        {orphanSearched && !orphanLoading && (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--muted, #6b7280)' }}>
              {orphans.length} orphan photo{orphans.length !== 1 ? 's' : ''} found
            </p>
            {orphans.length > 0 && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {orphans.map(o => (
                    <label key={o.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={orphanSelected.has(o.name)}
                        onChange={e => {
                          setOrphanSelected(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(o.name); else next.delete(o.name);
                            return next;
                          });
                        }}
                      />
                      <img
                        src={photoUrl(o.name)}
                        alt={o.name}
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: orphanSelected.has(o.name) ? '2px solid #6366f1' : '2px solid transparent' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted, #6b7280)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatIST(o.created_at)}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  className="btn btn--danger btn--sm"
                  disabled={orphanSelected.size === 0 || orphanDeleting}
                  onClick={deleteSelectedOrphans}
                >
                  <Trash2 size={14} style={{ marginRight: 4 }} />
                  {orphanDeleting ? 'Deleting…' : `Delete selected (${orphanSelected.size})`}
                </button>
              </>
            )}
          </>
        )}
      </section>

      {/* Delete branch confirm */}
      <ConfirmDialog
        open={deleteBranchName !== null && !deleteBranchError}
        title="Delete branch?"
        description={`Delete "${deleteBranchName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteBranchName) deleteBranch(deleteBranchName); }}
        onCancel={() => { setDeleteBranchName(null); setDeleteBranchError(''); }}
      />
    </div>
  );
}
