/**
 * src/components/UpdatePrompt.tsx
 * "A new version is ready" bar. Mount once in App.tsx. Never reloads by itself (nobody loses a half-typed form).
 * Rendered in a portal so it sits above every screen, including the full-screen scanner.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { FixedPortal } from './member/ui';

export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => { void reg.update(); }, 60 * 60 * 1000);          // hourly check
      document.addEventListener('visibilitychange', () => {              // and whenever the app is reopened
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <FixedPortal>
      <div
        role="status"
        style={{
          position: 'fixed', left: '50%', translate: '-50% 0', zIndex: 1300,
          top: 'calc(12px + env(safe-area-inset-top))', width: 'min(calc(100% - 24px), 406px)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 16px',
          borderRadius: 999, background: 'var(--ink)', color: 'var(--paper)', boxShadow: '0 8px 30px rgba(20,18,58,.35)',
          fontWeight: 700, fontSize: 14.5,
        }}
      >
        <span style={{ flex: 1 }}>A new version is ready.</span>
        <button className="btn btn--sun btn--sm" onClick={() => void updateServiceWorker(true)}>Update</button>
        <button
          onClick={() => setNeedRefresh(false)} aria-label="Dismiss"
          style={{ width: 36, height: 36, border: 0, borderRadius: '50%', background: 'rgba(236,238,248,.15)', color: 'inherit', cursor: 'pointer' }}
        >✕</button>
      </div>
    </FixedPortal>
  );
}

export default UpdatePrompt;
