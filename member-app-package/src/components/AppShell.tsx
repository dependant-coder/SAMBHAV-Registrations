/**
 * src/components/AppShell.tsx
 * Page frame for every in-app screen: offline bar, the page itself, and the fixed bottom tab bar.
 * The tab bar is rendered in a portal OUTSIDE .mapp, because .mapp has container-type
 * (which would turn it into the containing block for position:fixed).
 */
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useMember } from '../contexts/MemberContext';
import { syncPush } from '../hooks/usePush';
import { AppFrame, FixedPortal, Ic, OfflineBar } from './member/ui';
import type { IconName } from './member/ui';

type Tab = { to: string; label: string; icon: IconName; match: (p: string) => boolean; badge?: number };

export default function AppShell() {
  const { roles, unread, refreshUnread } = useMember();
  const { pathname } = useLocation();

  // keep the push subscription in sync on every app open
  useEffect(() => { void syncPush().catch(() => {}); }, []);
  // refresh the unread badge when moving between screens (cheap, RLS-filtered)
  useEffect(() => { void refreshUnread(); }, [pathname, refreshUnread]);

  const tabs: Tab[] = [
    { to: '/app', label: 'Home', icon: 'home', match: (p) => p === '/app' || p === '/app/' || p.startsWith('/app/id') },
    { to: '/app/announcements', label: 'Updates', icon: 'mega', match: (p) => p.startsWith('/app/announcements'), badge: unread },
    { to: '/app/events', label: 'Events', icon: 'cal', match: (p) => p.startsWith('/app/events') },
    ...(roles.length > 0
      ? [{ to: '/app/lead', label: 'Lead', icon: 'shield' as IconName, match: (p: string) => p.startsWith('/app/lead') }]
      : []),
    { to: '/app/profile', label: 'Me', icon: 'user', match: (p) => p.startsWith('/app/profile') },
  ];

  return (
    <AppFrame>
      <OfflineBar />
      <Outlet />
      <FixedPortal>
        <nav className="tabbar" aria-label="Main">
          {tabs.map((t) => {
            const active = t.match(pathname);
            return (
              <Link key={t.to} to={t.to} className="tab" aria-current={active ? 'page' : undefined}>
                <span className="pill"><Ic n={t.icon} /></span>
                {t.label}
                {t.badge ? <i className="badge" aria-label={`${t.badge} unread`}>{t.badge > 9 ? '9+' : t.badge}</i> : null}
              </Link>
            );
          })}
        </nav>
      </FixedPortal>
    </AppFrame>
  );
}
