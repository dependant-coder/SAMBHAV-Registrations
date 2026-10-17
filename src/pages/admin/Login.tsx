import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../contexts/AdminContext';
import { InfoBox } from '../../components/InfoBox';
import { Lock, ArrowLeft } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading: adminLoading } = useAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationMessage = (location.state as { message?: string } | null)?.message ?? null;

  // If already logged in as admin, redirect
  useEffect(() => {
    if (!adminLoading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [adminLoading, user, isAdmin, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !signInData.session) {
        setError(signInError?.message ?? 'Sign-in failed. Check your credentials.');
        return;
      }

      const session = signInData.session;

      // Check admin row
      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .single();

      if (!adminRow) {
        await supabase.auth.signOut();
        setError("This account doesn't have admin access.");
        return;
      }

      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  if (adminLoading) {
    return (
      <div className="fullscreen-center" style={{ background: 'var(--paper)', minHeight: '100dvh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="riso-shell">
      <div
        className="riso app"
        data-tone="sun"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem 1rem',
          background: 'var(--paper)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
          {/* Top navigation link & badge */}
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
              <span>Back to site</span>
            </Link>
            <span className="admin-badge admin-badge--pink" style={{ fontSize: '11px', padding: '4px 10px' }}>
              ADMIN PORTAL
            </span>
          </div>

          {/* Poster card */}
          <div
            className="admin-card"
            style={{
              padding: '2rem 1.5rem',
              marginBottom: 0,
              borderRadius: '24px 24px 24px 12px',
              border: '3px solid var(--ink)',
              boxShadow: '5px 5px 0 var(--ink)',
              background: 'var(--white)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
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
                <Lock size={22} color="var(--ink)" strokeWidth={2.6} />
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
                  Admin Sign In
                </h1>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-soft)', margin: '2px 0 0 0' }}>
                  Sambhav 4.0 Organizing Team
                </p>
              </div>
            </div>

            {locationMessage && (
              <InfoBox variant="info" style={{ marginBottom: '1.25rem' }}>
                {locationMessage}
              </InfoBox>
            )}

            {error && (
              <InfoBox variant="error" style={{ marginBottom: '1.25rem' }}>
                {error}
              </InfoBox>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1.1rem' }}>
              <div className="field">
                <label
                  htmlFor="admin-email"
                  className="field__label"
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}
                >
                  Email address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  className="field__input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={submitting}
                  placeholder="admin@example.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2.5px solid var(--ink)',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    padding: '12px 14px',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="field">
                <label
                  htmlFor="admin-password"
                  className="field__label"
                  style={{ display: 'block', fontSize: '0.875rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  className="field__input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '2.5px solid var(--ink)',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    padding: '12px 14px',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn--sun btn--block"
                style={{
                  marginTop: '0.5rem',
                  minHeight: 52,
                  fontSize: '1rem',
                  fontWeight: 800,
                  border: '2.5px solid var(--ink)',
                  borderRadius: '14px',
                  boxShadow: '3px 3px 0 var(--ink)',
                  cursor: submitting ? 'wait' : 'pointer',
                  width: '100%',
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span className="loading-spinner" style={{ width: 18, height: 18 }} />
                    Signing in…
                  </span>
                ) : (
                  'Sign in to Admin Dashboard'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
