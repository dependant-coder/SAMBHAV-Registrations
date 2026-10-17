// useInAppBrowser.ts — detect Instagram/FB/Snapchat/LinkedIn in-app browsers
import { useMemo } from 'react';

const IN_APP_PATTERNS = [
  /FBAN|FBAV/,      // Facebook
  /Instagram/,
  /Snapchat/,
  /LinkedInApp/,
  /Pinterest/,
  /Twitter/,
  /\bGSA\b/,        // Google search app
  /SamsungBrowser/, // Sometimes limited
];

export function useInAppBrowser(): boolean {
  return useMemo(() => {
    const ua = navigator.userAgent;
    return IN_APP_PATTERNS.some(p => p.test(ua));
  }, []);
}
