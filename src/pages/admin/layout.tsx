// layout.tsx — AdminLayout: sidebar + mobile bottom tab bar per spec §10.0
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Clock, PenLine, ClipboardList, Settings,
  Megaphone, Calendar, FileText, QrCode,
  type LucideIcon,
} from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/events', label: 'Events', icon: Calendar },
  { to: '/admin/scan', label: 'Scan IDs', icon: QrCode },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/pending', label: 'Pending', icon: Clock },
  { to: '/admin/edit-requests', label: 'Edit Requests', icon: PenLine },
  { to: '/admin/allow-list', label: 'Allow-list', icon: ClipboardList },
  { to: '/admin/audit', label: 'Audit Log', icon: FileText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const PENDING_SLUGS = new Set(['/admin/pending', '/admin/edit-requests']);

const isDevEnv =
  typeof import.meta !== 'undefined' &&
  (import.meta.env.VITE_SUPABASE_URL?.includes('localhost') ||
    import.meta.env.VITE_SUPABASE_URL?.includes('127.0.0.1'));

export function AdminLayout() {
  const navigate = useNavigate();
  const { signOut } = useAdmin();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchPending() {
      try {
        const { count } = await supabase
          .from('edit_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (!cancelled) setPendingCount(count ?? 0);
      } catch {
        if (!cancelled) setPendingCount(0);
      }
    }

    fetchPending();
    const interval = setInterval(fetchPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login');
  }

  return (
    <div className="riso" style={{ minHeight: '100dvh', background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Dev environment banner */}
      {isDevEnv && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--sun)',
            color: 'var(--ink)',
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '4px 0',
            borderBottom: '2px solid var(--ink)',
          }}
        >
          Dev environment
        </div>
      )}

      {/* Mobile top header (locks height to prevent layout shifts when switching tabs) */}
      <header className="admin-mobile-header" style={{ top: isDevEnv ? 24 : 0 }}>
        <div className="admin-mobile-title">
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.1rem' }}>
            Sambhav 4.0
          </span>
          <span className="admin-badge admin-badge--sun">ADMIN</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="btn btn--ghost btn--sm"
          style={{ minHeight: 34, padding: '0 12px', fontSize: '13px' }}
        >
          Sign out
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside
        className="admin-sidebar"
        style={{
          position: 'fixed',
          left: 0,
          top: isDevEnv ? 24 : 0,
          bottom: 0,
          width: 220,
          background: 'var(--white)',
          borderRight: '2.5px solid var(--ink)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 0.75rem',
          zIndex: 100,
        }}
      >
        <div style={{ padding: '0 0.5rem 1rem', borderBottom: '2px solid var(--ink)', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--ink)' }}>
              Sambhav
            </span>
            <span className="admin-badge admin-badge--pink">4.0</span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-soft)' }}>Admin Panel</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 0.85rem',
                borderRadius: '12px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 800 : 700,
                color: 'var(--ink)',
                background: isActive ? 'var(--sun)' : 'transparent',
                border: isActive ? '2px solid var(--ink)' : '2px solid transparent',
                boxShadow: isActive ? '2px 2px 0 var(--ink)' : 'none',
                transition: 'all 0.12s ease',
              })}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
              {PENDING_SLUGS.has(item.to) && pendingCount > 0 && (
                <span
                  className="admin-badge admin-badge--pink"
                  style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: '11px' }}
                >
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ paddingTop: '0.75rem', borderTop: '2px solid var(--ink)' }}>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content area (stable width and bounds across tabs) */}
      <main
        className="admin-main"
        style={{
          marginLeft: 220,
          minHeight: '100dvh',
          padding: '2rem 1.5rem',
          maxWidth: 1200,
          paddingTop: isDevEnv ? 'calc(2rem + 24px)' : '2rem',
        }}
      >
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="admin-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'var(--white)',
          borderTop: '2.5px solid var(--ink)',
          display: 'flex',
          overflowX: 'auto',
          alignItems: 'center',
          gap: 4,
          padding: '0 6px',
          zIndex: 100,
          boxShadow: '0 -2px 0 rgba(20, 18, 58, 0.05)',
        }}
      >
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              gap: 2,
              fontSize: '0.62rem',
              fontWeight: isActive ? 800 : 700,
              textDecoration: 'none',
              color: 'var(--ink)',
              position: 'relative',
              padding: '4px 8px',
              borderRadius: '10px',
              background: isActive ? 'var(--sun)' : 'transparent',
              border: isActive ? '1.5px solid var(--ink)' : '1.5px solid transparent',
              whiteSpace: 'nowrap',
            })}
          >
            <item.icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
            {PENDING_SLUGS.has(item.to) && pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  background: 'var(--pink)',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  borderRadius: 999,
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  padding: '0 4px',
                  minWidth: 12,
                  textAlign: 'center',
                }}
              >
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Responsive CSS layout fixes */}
      <style>{`
        @media (min-width: 769px) {
          .admin-bottom-bar { display: none !important; }
        }
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-main {
            margin-left: 0 !important;
            padding-top: ${isDevEnv ? '80px' : '72px'} !important;
            padding-bottom: 80px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
