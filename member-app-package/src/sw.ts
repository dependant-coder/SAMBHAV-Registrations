/// <reference lib="webworker" />
/**
 * src/sw.ts   service worker: offline app shell + push notifications.
 * Built by vite-plugin-pwa (strategies: 'injectManifest'). Exclude this file from tsconfig.app.json.
 *
 * Rules:
 *  - Only the built app files are precached.
 *  - Supabase / API calls are NEVER cached (tokens and private data must not live in a cache).
 *  - Notifications only ever open same-origin URLs.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA: every page navigation gets index.html, also offline
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/supabase-proxy/, /^\/api\//],
  }),
);

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/* ----------------------------- Push ----------------------------- */
type PushData = { title?: string; body?: string; url?: string; tag?: string };

self.addEventListener('push', (event) => {
  let data: PushData = {};
  try { data = (event.data?.json() as PushData) ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(String(data.title || 'Sambhav').slice(0, 100), {
      body: String(data.body || '').slice(0, 200),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,                       // same tag replaces an older notification instead of stacking
      data: { url: data.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target: string;
  try {
    const u = new URL(event.notification.data?.url || '/app', self.location.origin);
    target = u.origin === self.location.origin ? u.href : new URL('/app', self.location.origin).href;   // never leave the site
  } catch {
    target = new URL('/app', self.location.origin).href;
  }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus();
        try { await (w as WindowClient).navigate(target); } catch { /* some browsers refuse: the focus is enough */ }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
