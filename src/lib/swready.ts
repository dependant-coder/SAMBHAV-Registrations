/**
 * src/lib/swready.ts
 * navigator.serviceWorker.ready NEVER resolves when no service worker is registered (dev server, blocked, first load
 * before activation). Awaiting it directly freezes sign-out and push toggles. This gives up after a few seconds.
 */
export async function swReady(timeoutMs = 4000): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('no_service_worker');
  let timer: number | undefined;
  const timeout = new Promise<never>((_, rej) => { timer = window.setTimeout(() => rej(new Error('no_service_worker')), timeoutMs); });
  try { return await Promise.race([navigator.serviceWorker.ready, timeout]); }
  finally { window.clearTimeout(timer); }
}
