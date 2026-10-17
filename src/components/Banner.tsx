// ============================================================
// Banner.tsx — Offline, In-App Browser, Closed, Deadline & Draft banners
// Styled for the riso layout per spec §7.4 & §8.5
// ============================================================
import { useState } from 'react';
import { useOnline } from '../hooks/useOnline';
import { useInAppBrowser } from '../hooks/useInAppBrowser';
import { useApp } from '../contexts/AppContext';
import { formatIST } from '../lib/dates';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="banner banner--offline" aria-live="assertive">
      <i className="banner__dot" aria-hidden="true" />
      <span>
        <strong>You’re offline.</strong> Your answers are saved on this phone. Reconnect to submit.
      </span>
    </div>
  );
}

export function InAppBrowserBanner() {
  const isInApp = useInAppBrowser();
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isInApp || dismissed) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div role="status" className="banner banner--inapp">
      <i className="banner__dot" aria-hidden="true" />
      <span>
        <strong>Open this in Chrome or Safari.</strong> Photo upload can be unreliable in this app’s browser. Tap the menu, then choose Open in browser.{' '}
        <button type="button" className="linkbtn" onClick={handleCopy}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        {' · '}
        <button type="button" className="linkbtn" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </span>
    </div>
  );
}

export function RegistrationClosedBanner() {
  const { registrationIsOpen, settings } = useApp();
  if (registrationIsOpen || !settings) return null;
  return (
    <div role="status" className="banner banner--closed">
      <i className="banner__dot" aria-hidden="true" />
      <span>
        <strong>Registration is closed.</strong> If you were selected but haven’t registered, message the core team below.
      </span>
    </div>
  );
}

export function DeadlineBanner() {
  const { settings, registrationIsOpen, deadlineIsNear } = useApp();
  if (!registrationIsOpen || !settings?.registration_deadline || !deadlineIsNear) return null;
  return (
    <div role="status" className="banner banner--inapp">
      <i className="banner__dot" aria-hidden="true" />
      <span>
        <strong>Registration closes on {formatIST(settings.registration_deadline)}.</strong> Register before the deadline.
      </span>
    </div>
  );
}

export function DraftBanner({ onStartOver }: { onStartOver: () => void }) {
  return (
    <div role="status" className="banner">
      <i className="banner__dot" aria-hidden="true" />
      <span>
        We restored what you typed earlier.{' '}
        <button type="button" className="linkbtn" onClick={onStartOver}>
          Start over
        </button>
      </span>
    </div>
  );
}

/** Renders all relevant global banners stacked in a .banners wrapper */
export function GlobalBanners() {
  const online = useOnline();
  const isInApp = useInAppBrowser();
  const { registrationIsOpen, settings, deadlineIsNear } = useApp();

  const showOffline = !online;
  const showInApp = isInApp;
  const showClosed = !registrationIsOpen && Boolean(settings);
  const showDeadline = Boolean(registrationIsOpen && settings?.registration_deadline && deadlineIsNear);

  if (!showOffline && !showInApp && !showClosed && !showDeadline) {
    return null;
  }

  return (
    <div className="banners" aria-label="Site notifications">
      {showOffline && <OfflineBanner />}
      {showInApp && <InAppBrowserBanner />}
      {showClosed && <RegistrationClosedBanner />}
      {showDeadline && <DeadlineBanner />}
    </div>
  );
}
