// RequestEdit.tsx — Riso-styled & Mobile-Optimized Request Edit Page
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { GlobalBanners } from '../components/Banner';
import { HelpFooter } from '../components/HelpFooter';
import { InfoBox } from '../components/InfoBox';
import { requestEdit, getEditStatus } from '../lib/api';
import type { EditStatusResult } from '../lib/api';
import { normalizeRoll } from '../lib/normalize';
import { formatIST, hoursMinutesUntil } from '../lib/dates';
import { PenLine, ArrowLeft, Clock, CheckCircle2, AlertTriangle, XCircle, FileText, Send, RefreshCw } from 'lucide-react';

type Tab = 'request' | 'status';

function requestErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'no_match':
      return "We couldn't find a registration with that roll number and email. Check both and try again.";
    case 'already_open':
      return 'You already have an open edit request. Use Check status tab below.';
    case 'invalid_message':
      return 'Please write between 10 and 500 characters.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function RequestEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  // Shared identity fields
  const [roll, setRoll] = useState('');
  const [email, setEmail] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<Tab>('request');

  // Request tab state
  const [message, setMessage] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Status tab state
  const [statusResult, setStatusResult] = useState<EditStatusResult | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusIdentityError, setStatusIdentityError] = useState('');

  const autoCheckedRef = useRef(false);

  // On mount: check if router requested status tab
  useEffect(() => {
    const state = location.state as { switchToStatus?: boolean } | null;
    if (state?.switchToStatus) {
      setActiveTab('status');
    }
  }, [location.state]);

  // Auto-trigger status check on switching tab if credentials present
  useEffect(() => {
    if (activeTab === 'status' && roll.trim() && email.trim() && !autoCheckedRef.current) {
      autoCheckedRef.current = true;
      handleCheckStatus();
    }
    if (activeTab !== 'status') {
      autoCheckedRef.current = false;
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'request') {
      setStatusError('');
      setStatusIdentityError('');
    } else {
      setRequestError('');
      setRequestSuccess(false);
    }
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setRequestError('');
    setRequestSuccess(false);

    if (message.trim().length < 10 || message.trim().length > 500) {
      setRequestError('Please write between 10 and 500 characters.');
      return;
    }

    setRequestLoading(true);
    try {
      const result = await requestEdit({
        p_roll: roll.trim().toUpperCase(),
        p_email: email.trim().toLowerCase(),
        p_message: message.trim(),
      });

      if (result.ok) {
        setRequestSuccess(true);
        setMessage('');
      } else {
        setRequestError(requestErrorMessage(result.code));
      }
    } catch {
      setRequestError('Something went wrong. Please try again.');
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleCheckStatus() {
    setStatusError('');
    setStatusIdentityError('');
    setStatusResult(null);

    if (!roll.trim() || !email.trim()) {
      setStatusIdentityError('Please enter your roll number and email above.');
      return;
    }

    setStatusLoading(true);
    try {
      const result = await getEditStatus(
        roll.trim().toUpperCase(),
        email.trim().toLowerCase(),
      );

      if (result.ok) {
        setStatusResult(result);
      } else {
        if (result.code === 'no_match') {
          setStatusError(
            "We couldn't find a registration with that roll number and email. Check both and try again.",
          );
        } else {
          setStatusError('Something went wrong. Please try again.');
        }
      }
    } catch {
      setStatusError('Something went wrong. Please try again.');
    } finally {
      setStatusLoading(false);
    }
  }

  function renderStatusCard(result: EditStatusResult) {
    const status = result.status;

    if (status === 'none') {
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="info">You have no active edit requests.</InfoBox>
        </div>
      );
    }

    if (status === 'pending') {
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <Clock size={18} />
              <span>Waiting for admin approval</span>
            </div>
            {result.created_at && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem' }}>
                Requested on {formatIST(result.created_at)}
              </p>
            )}
          </InfoBox>
        </div>
      );
    }

    if (status === 'approved') {
      const timeLeft = result.expires_at ? hoursMinutesUntil(result.expires_at) : null;
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="success">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <CheckCircle2 size={18} />
              <span>Approved! You can now edit your details.</span>
            </div>
            {result.expires_at && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem' }}>
                Window closes at {formatIST(result.expires_at)}
                {timeLeft && !timeLeft.expired && (
                  <strong> ({timeLeft.hours}h {timeLeft.minutes}m remaining)</strong>
                )}
                {timeLeft?.expired && <span> (window has closed)</span>}.
              </p>
            )}
          </InfoBox>
          <button
            type="button"
            className="btn btn--mint btn--block"
            style={{
              marginTop: '1rem',
              minHeight: 48,
              fontSize: '0.95rem',
              fontWeight: 800,
              border: '2.5px solid var(--ink)',
              boxShadow: '3px 3px 0 var(--ink)',
            }}
            onClick={() =>
              navigate('/edit', { state: { roll: roll.trim().toUpperCase(), email: email.trim().toLowerCase() } })
            }
          >
            Edit my details now →
          </button>
        </div>
      );
    }

    if (status === 'rejected') {
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="error">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <XCircle size={18} />
              <span>Request not approved</span>
            </div>
            {result.admin_note && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem' }}>Note from admin: {result.admin_note}</p>
            )}
          </InfoBox>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: '1rem', minHeight: 44, fontWeight: 800 }}
            onClick={() => switchTab('request')}
          >
            Send a new request
          </button>
        </div>
      );
    }

    if (status === 'completed') {
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="success">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <CheckCircle2 size={18} />
              <span>Your last edit was saved successfully</span>
            </div>
            {result.created_at && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem' }}>Saved on {formatIST(result.created_at)}</p>
            )}
          </InfoBox>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: '1rem', minHeight: 44, fontWeight: 800 }}
            onClick={() => {
              setMessage('');
              switchTab('request');
            }}
          >
            Request another edit
          </button>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div style={{ marginTop: '1.25rem' }}>
          <InfoBox variant="warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <AlertTriangle size={18} />
              <span>Editing window expired</span>
            </div>
            {result.expires_at && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem' }}>
                Closed on {formatIST(result.expires_at)}. Send a new request if you still need changes.
              </p>
            )}
          </InfoBox>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: '1rem', minHeight: 44, fontWeight: 800 }}
            onClick={() => switchTab('request')}
          >
            Send a new request
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="riso-shell">
      <GlobalBanners />

      <div className="riso app" data-tone="sun" style={{ minHeight: '100dvh', padding: '1.5rem 1rem 3rem' }}>
        <main id="main" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
          {/* Top navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              padding: '0 4px',
            }}
          >
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 800,
                fontSize: '0.9rem',
                color: 'var(--ink)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
              <span>Back to home</span>
            </Link>
            <span className="chip chip--pink">REQUEST AN EDIT</span>
          </div>

          {/* Main Riso Poster Card */}
          <div
            className="admin-card"
            style={{
              padding: '1.75rem 1.25rem',
              borderRadius: '24px 24px 24px 12px',
              border: '3px solid var(--ink)',
              boxShadow: '5px 5px 0 var(--ink)',
              background: 'var(--white)',
            }}
          >
            {/* Header Title Block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--sun)',
                  border: '2.5px solid var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '2px 2px 0 var(--ink)',
                }}
              >
                <PenLine size={22} color="var(--ink)" strokeWidth={2.6} />
              </span>
              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    margin: 0,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Request an edit
                </h1>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)', margin: '2px 0 0 0' }}>
                  Sambhav 4.0 Registration Corrections
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: '1.5rem' }}>
              Your details are locked after registration. If something needs fixing, describe your request below. A team admin will review it and grant you a <strong>48-hour editing window</strong>.
            </p>

            {/* ── Identity inputs (Shared across both tabs) ────────────────── */}
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="field">
                <label
                  htmlFor="req-roll"
                  className="field__label"
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}
                >
                  Roll number <span style={{ color: 'var(--pink)' }}>*</span>
                </label>
                <input
                  id="req-roll"
                  type="text"
                  className="field__input"
                  autoCapitalize="characters"
                  value={roll}
                  onChange={(e) => {
                    setRoll(normalizeRoll(e.target.value));
                    setRequestError('');
                    setStatusError('');
                    setStatusIdentityError('');
                    setStatusResult(null);
                  }}
                  placeholder="e.g. 22BCE1234"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2.5px solid var(--ink)',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '16px',
                    padding: '12px 14px',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="field">
                <label
                  htmlFor="req-email"
                  className="field__label"
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}
                >
                  Registered Email address <span style={{ color: 'var(--pink)' }}>*</span>
                </label>
                <input
                  id="req-email"
                  type="email"
                  className="field__input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.toLowerCase());
                    setRequestError('');
                    setStatusError('');
                    setStatusIdentityError('');
                    setStatusResult(null);
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2.5px solid var(--ink)',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '16px',
                    padding: '12px 14px',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* ── Riso Segment Pill Tabs ──────────────────────────────────── */}
            <div
              role="tablist"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                padding: '4px',
                background: 'var(--paper)',
                border: '2.5px solid var(--ink)',
                borderRadius: '16px',
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'request'}
                onClick={() => switchTab('request')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  fontWeight: activeTab === 'request' ? 800 : 700,
                  fontSize: '0.875rem',
                  border: activeTab === 'request' ? '2px solid var(--ink)' : '2px solid transparent',
                  background: activeTab === 'request' ? 'var(--sun)' : 'transparent',
                  boxShadow: activeTab === 'request' ? '2px 2px 0 var(--ink)' : 'none',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <FileText size={16} />
                <span>Request Edit</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'status'}
                onClick={() => switchTab('status')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  fontWeight: activeTab === 'status' ? 800 : 700,
                  fontSize: '0.875rem',
                  border: activeTab === 'status' ? '2px solid var(--ink)' : '2px solid transparent',
                  background: activeTab === 'status' ? 'var(--sun)' : 'transparent',
                  boxShadow: activeTab === 'status' ? '2px 2px 0 var(--ink)' : 'none',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <RefreshCw size={16} />
                <span>Check Status</span>
              </button>
            </div>

            {/* ── Request Tab Content ────────────────────────────────────── */}
            {activeTab === 'request' && (
              <section aria-label="Request an edit">
                <InfoBox variant="info" style={{ marginBottom: '1.25rem' }}>
                  Name, domain or roll number cannot be edited directly by members. Mention it in your message below and an admin will update it for you.
                </InfoBox>

                {requestSuccess && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <InfoBox variant="success">
                      <strong>Request sent!</strong> Our team will review it soon. Check back under <strong>Check status</strong> to see updates.
                    </InfoBox>
                    <button
                      type="button"
                      className="btn btn--mint btn--block"
                      style={{
                        marginTop: '1rem',
                        minHeight: 46,
                        fontWeight: 800,
                        border: '2.5px solid var(--ink)',
                        boxShadow: '3px 3px 0 var(--ink)',
                      }}
                      onClick={() => switchTab('status')}
                    >
                      Check status now →
                    </button>
                  </div>
                )}

                {!requestSuccess && (
                  <form onSubmit={handleSubmitRequest} noValidate style={{ display: 'grid', gap: '1rem' }}>
                    <div className="field">
                      <label
                        htmlFor="req-message"
                        className="field__label"
                        style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}
                      >
                        What do you need to change and why? <span style={{ color: 'var(--pink)' }}>*</span>
                      </label>
                      <textarea
                        id="req-message"
                        className="field__input"
                        rows={4}
                        value={message}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            setMessage(e.target.value);
                          }
                          setRequestError('');
                        }}
                        placeholder="Describe what needs to change (e.g., My phone number changed to 9876543210…)"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          border: '2.5px solid var(--ink)',
                          borderRadius: '12px',
                          fontWeight: 600,
                          fontSize: '16px',
                          padding: '12px 14px',
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                          outline: 'none',
                          resize: 'vertical',
                          minHeight: 110,
                          fontFamily: 'inherit',
                        }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--ink-soft)',
                        }}
                      >
                        <span>Between 10 and 500 characters</span>
                        <span style={{ color: message.length < 10 ? 'var(--pink)' : 'var(--ink)' }}>
                          {message.length} / 500
                        </span>
                      </div>
                    </div>

                    {requestError && (
                      <InfoBox variant="error" style={{ marginTop: '0.25rem' }}>
                        {requestError}
                      </InfoBox>
                    )}

                    <button
                      type="submit"
                      className="btn btn--sun btn--block"
                      style={{
                        marginTop: '0.5rem',
                        minHeight: 50,
                        fontSize: '1rem',
                        fontWeight: 800,
                        border: '2.5px solid var(--ink)',
                        borderRadius: '14px',
                        boxShadow: '3px 3px 0 var(--ink)',
                        cursor: requestLoading ? 'wait' : 'pointer',
                        width: '100%',
                      }}
                      disabled={requestLoading}
                    >
                      {requestLoading ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <span className="loading-spinner" style={{ width: 18, height: 18 }} />
                          Sending request…
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <Send size={18} />
                          <span>Submit Edit Request</span>
                        </span>
                      )}
                    </button>
                  </form>
                )}
              </section>
            )}

            {/* ── Check Status Tab Content ────────────────────────────────── */}
            {activeTab === 'status' && (
              <section aria-label="Check status">
                {statusIdentityError && (
                  <InfoBox variant="warning" style={{ marginBottom: '1rem' }}>
                    {statusIdentityError}
                  </InfoBox>
                )}

                <button
                  type="button"
                  className="btn btn--sun btn--block"
                  style={{
                    minHeight: 50,
                    fontSize: '1rem',
                    fontWeight: 800,
                    border: '2.5px solid var(--ink)',
                    borderRadius: '14px',
                    boxShadow: '3px 3px 0 var(--ink)',
                    cursor: statusLoading ? 'wait' : 'pointer',
                    width: '100%',
                  }}
                  onClick={handleCheckStatus}
                  disabled={statusLoading}
                >
                  {statusLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="loading-spinner" style={{ width: 18, height: 18 }} />
                      Checking status…
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={18} />
                      <span>Check Request Status</span>
                    </span>
                  )}
                </button>

                {statusError && (
                  <div style={{ marginTop: '1rem' }}>
                    <InfoBox variant="error">{statusError}</InfoBox>
                  </div>
                )}

                {statusResult && renderStatusCard(statusResult)}
              </section>
            )}
          </div>
        </main>
        <HelpFooter />
      </div>
    </div>
  );
}
