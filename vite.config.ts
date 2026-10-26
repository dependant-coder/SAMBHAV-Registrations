import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
        background_color: '#ECEEF8',
        theme_color: '#14123A',
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
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/supabase-proxy': {
        target: 'https://cshmcevqedzveldnrgmq.supabase.co',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/supabase-proxy/, ''),
      },
    },
  },
})

