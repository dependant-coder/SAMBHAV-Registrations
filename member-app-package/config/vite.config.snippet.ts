// Add to your existing vite.config.ts  (npm i -D vite-plugin-pwa workbox-precaching workbox-routing workbox-core)
import { VitePWA } from 'vite-plugin-pwa';

// inside defineConfig({ plugins: [ ..., VitePWA({...}) ] })
VitePWA({
  strategies: 'injectManifest',      // our own service worker (needed for push)
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',            // never reload someone mid-form; UpdatePrompt shows a bar instead
  injectRegister: false,
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'] },
  manifest: {
    id: '/app',
    name: 'Sambhav 4.0 Members',
    short_name: 'Sambhav',
    description: 'Announcements, events and your member ID for Sambhav members.',
    start_url: '/app?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ECEEF8',     // riso paper
    theme_color: '#14123A',          // riso ink
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My ID', url: '/app/id' },
      { name: 'Updates', url: '/app/announcements' },
      { name: 'Events', url: '/app/events' },
    ],
  },
  devOptions: { enabled: false },    // test with: npm run build && npm run preview
});
