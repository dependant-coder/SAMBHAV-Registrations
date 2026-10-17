// App.tsx
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { AdminProvider } from './contexts/AdminContext';
import { ToastProvider } from './components/Toast';
import AppRoutes from './routes';
import { ServerErrorScreen } from './components/ServerErrorScreen';
import { useApp } from './contexts/AppContext';
import { ScrollToTop } from './components/ScrollToTop';

import { DomainSprite } from './components/DomainSprite';

function AppInner() {
  const { loading, error, retry } = useApp();

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
    ><ScrollToTop />
      <AppProvider>
        <AdminProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </AdminProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
