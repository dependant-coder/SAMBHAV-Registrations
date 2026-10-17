// DomainSprite.tsx — SVG defs sprite for icons and domain glyphs
export function DomainSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-arrow-r" viewBox="0 0 24 24"><path d="M4 12h16M13 5l7 7-7 7"/></symbol>
        <symbol id="i-arrow-l" viewBox="0 0 24 24"><path d="M20 12H4M11 5l-7 7 7 7"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
        <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/></symbol>
        <symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.3-2h5.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z"/><circle cx="12" cy="12.5" r="3.4"/></symbol>
        <symbol id="i-image" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 3.5 3L16 12l4 4"/></symbol>
        <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></symbol>
        <symbol id="i-reset" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
        <symbol id="i-wa" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/></symbol>
        <symbol id="i-zoom-out" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/></symbol>
        <symbol id="i-zoom-in" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6M11 8v6"/></symbol>
        <symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8l11.3 8.5M8.2 16L19.5 7.5"/></symbol>

        {/* domain glyphs (same shapes as the Home tiles) */}
        <symbol id="g-management" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"/><circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="4"/><circle cx="32" cy="32" r="6" fill="currentColor"/></symbol>
        <symbol id="g-documentation" viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="9" rx="4.5" fill="currentColor"/><rect x="8" y="28" width="34" height="9" rx="4.5" fill="currentColor"/><rect x="8" y="46" width="42" height="9" rx="4.5" fill="currentColor"/></symbol>
        <symbol id="g-pr-marketing" viewBox="0 0 64 64"><g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><path d="M24 56A16 16 0 0 0 8 40"/><path d="M40 56A32 32 0 0 0 8 24"/><path d="M56 56A48 48 0 0 0 8 8"/></g><circle cx="8" cy="56" r="5" fill="currentColor"/></symbol>
        <symbol id="g-sponsorship" viewBox="0 0 64 64"><path d="M32 6 58 32 32 58 6 32Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/><circle cx="32" cy="32" r="9" fill="currentColor"/></symbol>
        <symbol id="g-design" viewBox="0 0 64 64"><circle cx="23" cy="32" r="20" fill="currentColor" fillOpacity=".62"/><circle cx="41" cy="32" r="20" fill="currentColor" fillOpacity=".62"/></symbol>
        <symbol id="g-decoration" viewBox="0 0 64 64"><g fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"><rect x="13" y="13" width="38" height="38" rx="3"/><rect x="13" y="13" width="38" height="38" rx="3" transform="rotate(45 32 32)"/></g><circle cx="32" cy="32" r="5" fill="currentColor"/></symbol>
        <symbol id="g-technical" viewBox="0 0 64 64"><g fill="currentColor"><circle cx="12" cy="12" r="5"/><circle cx="32" cy="12" r="5"/><circle cx="52" cy="12" r="5"/><circle cx="12" cy="32" r="5"/><circle cx="32" cy="32" r="10"/><circle cx="52" cy="32" r="5"/><circle cx="12" cy="52" r="5"/><circle cx="32" cy="52" r="5"/><circle cx="52" cy="52" r="5"/></g></symbol>
        <symbol id="g-media" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M26 20v24l20-12Z" fill="currentColor"/></symbol>
      </defs>
    </svg>
  );
}
