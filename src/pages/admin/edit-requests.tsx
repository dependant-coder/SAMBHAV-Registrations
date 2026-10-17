// edit-requests.tsx — Admin: Edit Requests (Spec §10.4)
import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Clock, CheckCircle, XCircle, RotateCcw, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminDecideEdit, photoUrl } from '../../lib/api';
import { formatIST, formatCountdown } from '../../lib/dates';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

type EditStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'expired';

interface MemberInfo {
  id: string;
  full_name: string;
  domain_slug: string;
  roll_number: string;
  phone: string;
  email: string;
  photo_path: string;
}

interface EditRequest {
  id: string;
  message: string;
  status: EditStatus;
  admin_note: string | null;
  created_at: string;
  expires_at: string | null;
  decided_at: string | null;
  members: MemberInfo;
}

type Tab = 'pending' | 'approved' | 'history';

interface ActionState {
  mode: 'approve' | 'reject' | null;
  note: string;
  loading: boolean;
  decided: boolean;
  decidedApproved: boolean;
  expiresAt: string | null;
}

export function AdminEditRequests() {
  const { show } = useToast();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*, members!inner(id, full_name, domain_slug, roll_number, phone, email, photo_path)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as EditRequest[]);
    } catch {
      show('Failed to load edit requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  function getActionState(id: string): ActionState {
    return actionStates[id] ?? { mode: null, note: '', loading: false, decided: false, decidedApproved: false, expiresAt: null };
  }

  function setActionState(id: string, patch: Partial<ActionState>) {
    setActionStates(prev => ({ ...prev, [id]: { ...getActionState(id), ...patch } }));
  }

  async function handleDecide(req: EditRequest, approve: boolean) {
    const state = getActionState(req.id);
    setActionState(req.id, { loading: true });
    try {
      const result = await adminDecideEdit(req.id, approve, state.note || undefined);
      if (!result.ok && result.code === 'already_closed') {
        show('Someone already handled this request', 'warning');
        await load();
        return;
      }
      if (!result.ok) {
        show('Failed to process request', 'error');
        return;
      }
      // Optimistically update
      const expiresAt = approve
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // placeholder; real value from DB
        : null;
      setActionState(req.id, { decided: true, decidedApproved: approve, expiresAt, loading: false, mode: null });
      show(approve ? 'Request approved' : 'Request rejected', 'success');
      // Reload to get fresh expires_at
      await load();
    } catch {
      show('Error processing request', 'error');
      setActionState(req.id, { loading: false });
    }
  }

  async function handleRevoke(req: EditRequest) {
    setActionState(req.id, { loading: true });
    try {
      const result = await adminDecideEdit(req.id, false, 'Revoked by admin');
      if (!result.ok) {
        show('Failed to revoke', 'error');
        setActionState(req.id, { loading: false });
        return;
      }
      show('Approval revoked', 'success');
      await load();
    } catch {
      show('Error revoking request', 'error');
      setActionState(req.id, { loading: false });
    }
  }

  function buildWhatsAppUrl(req: EditRequest, approved: boolean): string {
    const member = req.members;
    const firstName = member.full_name.split(' ')[0];
    const origin = window.location.origin;
    const state = getActionState(req.id);
    const expiresAt = state.expiresAt ?? req.expires_at;
    let msg: string;
    if (approved) {
      msg = `Hi ${firstName}, your edit request for Sambhav 4.0 is approved. Open ${origin}/request-edit, tap Check status, then Edit my details. The window closes at ${formatIST(expiresAt)}.`;
    } else {
      const note = state.note || '';
      msg = `Hi ${firstName}, your edit request for Sambhav 4.0 couldn't be approved.${note ? ' ' + note : ''}`;
    }
    return `https://wa.me/91${member.phone}?text=${encodeURIComponent(msg)}`;
  }

  const pendingList = requests.filter(r => r.status === 'pending');
  const approvedList = requests.filter(r => r.status === 'approved');
  const historyList = requests.filter(r => ['rejected', 'completed', 'expired'].includes(r.status));

  const tabList: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingList.length },
    { key: 'approved', label: 'Approved (open)', count: approvedList.length },
    { key: 'history', label: 'History', count: historyList.length },
  ];

  const currentList = tab === 'pending' ? pendingList : tab === 'approved' ? approvedList : historyList;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="loading-spinner" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Loading edit requests…</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-title">Edit Requests</h1>

      {/* Riso Pill Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabList.map(t => (
          <button
            key={t.key}
            type="button"
            className={`admin-pill-tab ${tab === t.key ? 'admin-pill-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count > 0 && (
              <span className="admin-badge admin-badge--pink">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={MessageSquare}
            title={tab === 'pending' ? 'No pending requests' : tab === 'approved' ? 'No open approvals' : 'No history yet'}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {currentList.map(req => {
            const member = req.members;
            const state = getActionState(req.id);
            return (
              <div key={req.id} className="admin-card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {/* Photo */}
                  <img
                    src={photoUrl(member.photo_path)}
                    alt={member.full_name}
                    style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid var(--ink)', objectFit: 'cover', flexShrink: 0, background: 'var(--paper)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--ink)' }}>{member.full_name}</strong>
                      <span className="admin-badge admin-badge--paper">{member.domain_slug}</span>
                      <span className={`admin-badge ${req.status === 'pending' ? 'admin-badge--pink' : req.status === 'approved' ? 'admin-badge--mint' : 'admin-badge--sun'}`}>
                        {req.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {member.roll_number} · {member.email} · {member.phone}
                    </div>
                    <blockquote style={{ margin: '0.75rem 0 0', padding: '0.65rem 0.85rem', borderLeft: '3.5px solid var(--ink)', background: 'var(--paper)', border: '1.5px solid var(--ink)', borderLeftWidth: 4, borderRadius: '0 10px 10px 0', fontSize: '0.9rem', color: 'var(--ink)' }}>
                      {req.message}
                    </blockquote>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-soft)', marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><Clock size={12} style={{ marginRight: 3 }} />{formatIST(req.created_at)}</span>
                      {req.status === 'approved' && req.expires_at && (
                        <span style={{ color: 'var(--pink)', fontWeight: 800 }}>Expires in {formatCountdown(req.expires_at)}</span>
                      )}
                    </div>

                    {/* Pending actions */}
                    {req.status === 'pending' && !state.decided && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {state.mode === null && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn--primary btn--sm" onClick={() => setActionState(req.id, { mode: 'approve' })}>
                              <CheckCircle size={14} style={{ marginRight: 4 }} />Approve
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={() => setActionState(req.id, { mode: 'reject' })}>
                              <XCircle size={14} style={{ marginRight: 4 }} />Reject
                            </button>
                          </div>
                        )}
                        {state.mode !== null && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <textarea
                              className="field__input"
                              rows={2}
                              placeholder={state.mode === 'approve' ? 'Add a note for the member (optional)' : 'Reason for rejection (encouraged)'}
                              value={state.note}
                              onChange={e => setActionState(req.id, { note: e.target.value })}
                              style={{ width: '100%', resize: 'vertical', marginBottom: '0.5rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className={`btn btn--sm ${state.mode === 'approve' ? 'btn--primary' : 'btn--danger'}`}
                                disabled={state.loading}
                                onClick={() => handleDecide(req, state.mode === 'approve')}
                              >
                                {state.loading ? '…' : state.mode === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                              </button>
                              <button className="btn btn--ghost btn--sm" onClick={() => setActionState(req.id, { mode: null, note: '' })}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Post-decision WhatsApp notify */}
                    {state.decided && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <a
                          href={buildWhatsAppUrl(req, state.decidedApproved)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--secondary btn--sm"
                        >
                          <MessageCircle size={14} style={{ marginRight: 4 }} />
                          Notify on WhatsApp
                        </a>
                      </div>
                    )}

                    {/* Approved: revoke */}
                    {req.status === 'approved' && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          className="btn btn--danger btn--sm"
                          disabled={state.loading}
                          onClick={() => handleRevoke(req)}
                        >
                          <RotateCcw size={14} style={{ marginRight: 4 }} />
                          {state.loading ? 'Revoking…' : 'Revoke'}
                        </button>
                        <a
                          href={buildWhatsAppUrl(req, true)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--ghost btn--sm"
                        >
                          <MessageCircle size={14} style={{ marginRight: 4 }} />
                          Notify on WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
