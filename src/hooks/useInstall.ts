/**
 * src/hooks/useInstall.ts
 * Install-to-home-screen state. Android/desktop Chrome gets a real prompt; iPhone only gets instructions.
 *
 * The browser fires `beforeinstallprompt` ONCE, early, often before the page that shows the banner has mounted.
 * So the listener is attached when this module loads (App.tsx imports it at startup) and the event is kept here.
 */
import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferredEvt: BIPEvent | null = null;
let installedFlag = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredEvt = e as BIPEvent; notify(); });
  window.addEventListener('appinstalled', () => { installedFlag = true; deferredEvt = null; notify(); });
}

export function isStandaloneNow() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOSDevice() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);

  const standalone = isStandaloneNow();

  const promptInstall = async () => {
    const e = deferredEvt;
    if (!e) return;
    await e.prompt();
    await e.userChoice;
    deferredEvt = null;
    notify();
  };

  return {
    isStandalone: standalone || installedFlag,
    canPrompt: !!deferredEvt,
    showIOSHint: isIOSDevice() && !standalone,
    promptInstall,
  };
}
