/**
 * src/hooks/usePush.ts
 * Web Push client. Ask for permission ONLY from a button tap, never on page load.
 * Status: unsupported | needs_install | denied | off | on | busy
 */
import { useCallback, useEffect, useState } from 'react';
import { swReady } from '../lib/swready';
import { supabase } from '../lib/supabase';
import { isIOSDevice, isStandaloneNow } from './useInstall';

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

export type PushStatus = 'unsupported' | 'needs_install' | 'denied' | 'off' | 'on' | 'busy';

function urlBase64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_ua: navigator.userAgent,
  });
  if (error) throw error;
}

export async function enablePush() {
  if (!supported()) throw new Error('unsupported');
  if (!VAPID) throw new Error('missing_vapid');
  const perm = await Notification.requestPermission(); // MUST come from a tap
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed');
  const reg = await swReady();
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // if the VAPID key ever changed the old subscription is unusable: drop it
    const cur = sub.options.applicationServerKey;
    if (cur && b64url(cur) !== VAPID) { await sub.unsubscribe(); sub = null; }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
  await save(sub);
}

export async function disablePush() {
  const reg = await swReady();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}

/** Run on every app open: keeps the server in step with the browser. */
export async function syncPush() {
  if (!supported() || Notification.permission !== 'granted') return;
  const reg = await swReady();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) { try { await enablePush(); } catch { /* silently give up */ } return; }
  await save(sub);
}

async function detect(): Promise<PushStatus> {
  if (isIOSDevice() && !isStandaloneNow()) return 'needs_install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    try {
      const reg = await swReady();
      return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
    } catch { return 'off'; }
  }
  return 'off';
}

export function usePush() {
  const [status, setStatus] = useState<PushStatus>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recheck = useCallback(async () => setStatus(await detect()), []);
  useEffect(() => { void recheck(); }, [recheck]);

  const enable = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      await enablePush();
      await recheck();
      return true;
    } catch (e) {
      const m = (e as Error).message;
      setError(m === 'dismissed' ? null : m === 'denied' ? 'denied' : m === 'unsupported' ? 'unsupported' : 'failed');
      await recheck();
      return false;
    } finally { setBusy(false); }
  }, [recheck]);

  const disable = useCallback(async () => {
    setBusy(true); setError(null);
    try { await disablePush(); await recheck(); return true; }
    catch { setError('failed'); return false; }
    finally { setBusy(false); }
  }, [recheck]);

  return { status: busy ? ('busy' as PushStatus) : status, rawStatus: status, busy, error, enable, disable, recheck };
}
