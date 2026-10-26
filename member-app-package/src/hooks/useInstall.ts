/**
 * src/hooks/useInstall.ts
 * Install-to-home-screen state. Android/desktop Chrome gets a real prompt; iPhone only gets instructions.
 */
import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function isStandaloneNow() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOSDevice() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export function useInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const standalone = isStandaloneNow();

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return {
    isStandalone: standalone || installed,
    canPrompt: !!deferred,
    showIOSHint: isIOSDevice() && !standalone,
    promptInstall,
  };
}
