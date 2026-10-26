/**
 * src/components/InstallBanner.tsx
 * Android: "Install" button. iPhone: 3-step hint. Hidden once installed; dismissable for 7 days.
 */
import { useState } from 'react';
import { useInstall } from '../hooks/useInstall';
import { dismissFor, dismissedUntil } from '../lib/cache';

export default function InstallBanner({ dismissable = false }: { dismissable?: boolean }) {
  const { isStandalone, canPrompt, showIOSHint, promptInstall } = useInstall();
  const [hidden, setHidden] = useState(() => dismissedUntil('install'));

  if (isStandalone || hidden || (!canPrompt && !showIOSHint)) return null;
  const close = () => { dismissFor('install', 7); setHidden(true); };

  if (canPrompt) {
    return (
      <div className="install">
        <span className="install__ic">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="12" cy="16" r="10" fill="#ECEEF8" /><circle cx="20" cy="16" r="10" fill="#FFB81C" />
          </svg>
        </span>
        <span>
          <strong style={{ display: 'block' }}>Install the app</strong>
          <span className="small" style={{ opacity: 0.8 }}>Faster, and works offline</span>
        </span>
        <button className="btn btn--sun" onClick={() => void promptInstall()}>Install</button>
        {dismissable && <button className="linkbtn" style={{ color: 'inherit' }} onClick={close} aria-label="Dismiss">✕</button>}
      </div>
    );
  }

  return (
    <div className="ios">
      <strong>Install on iPhone</strong>
      <ol>
        <li>Tap the <b>Share</b> button in Safari</li>
        <li>Choose <b>Add to Home Screen</b></li>
        <li>Open Sambhav from your home screen</li>
      </ol>
      {dismissable && <button className="linkbtn" style={{ marginTop: 8 }} onClick={close}>Not now</button>}
    </div>
  );
}
