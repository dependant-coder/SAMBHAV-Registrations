// App.tsx
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { AdminProvider } from './contexts/AdminContext';
import { MemberProvider } from './contexts/MemberContext';
import { UpdatePrompt } from './components/UpdatePrompt';
import './styles/member.css';   // scoped under .mapp-root, cannot affect the registration site
import './hooks/useInstall';
import { ToastProvider } from './components/Toast';
import AppRoutes from './routes';
import { ServerErrorScreen } from './components/ServerErrorScreen';
import { useApp } from './contexts/AppContext';
import { ScrollToTop } from './components/ScrollToTop';

import { DomainSprite } from './components/DomainSprite';

// The members app, the ID verify page and the OAuth callback have their own loading/error handling,
// so they must not wait for (or be blocked by) the registration site's data fetch.
const isMemberArea = (p: string) => p === '/app' || p.startsWith('/app/') || p.startsWith('/verify/') || p === '/auth/callback';

function AppInner() {
  const { loading, error, retry } = useApp();
  const { pathname } = useLocation();

  if (isMemberArea(pathname)) return <AppRoutes />;

  if (loading) {
    return (
      <div className="fullscreen-center">
        <div className="loading-spinner" aria-label="Loading…" />
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--ink-soft)' }}>Loading portal…</p>
      </div>
    );
  }

  if (error) {
    return <ServerErrorScreen onRetry={retry} />;
  }

  return (
    <div className="app-container">
      <DomainSprite />
      <AppRoutes />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollToTop />
      <AppProvider>
        <AdminProvider>
          <MemberProvider>
            <ToastProvider>
              <AppInner />
              <UpdatePrompt />
            </ToastProvider>
          </MemberProvider>
        </AdminProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
