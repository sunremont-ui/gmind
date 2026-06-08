import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// In the Tauri desktop build the app is served from tauri.localhost and a
// service worker only causes harm: it precaches the bundle (with the dev-time
// relative /api URLs) and keeps serving it after updates, so the packaged app
// can't reach the sidecar. There we ship a self-destroying SW that unregisters
// itself and clears caches (also evicting any stale SW from older installs).
// The web/Docker build keeps the full offline-first PWA.
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  plugins: [
    react(),
    isTauriBuild
      ? VitePWA({ selfDestroying: true, registerType: 'autoUpdate' })
      : VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      devOptions: { enabled: true },
      manifest: {
        name: 'Gmind - Mind Mapping',
        short_name: 'Gmind',
        description: 'Cloud-based mind mapping with AI and real-time collaboration',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/v1\/(workbooks|health)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 1011,
    proxy: {
      '/api': 'http://localhost:1010',
      '/ws': {
        target: 'ws://localhost:1010',
        ws: true,
      },
    },
  },
})
