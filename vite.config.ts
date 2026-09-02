import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_APP_BASE_PATH || '/'
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Lectura de libros',
          short_name: 'Lectura',
          description: 'Biblioteca personal y un espacio privado entre páginas.',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#f7f4ed',
          theme_color: '#5C068C',
          orientation: 'portrait-primary',
          categories: ['books', 'lifestyle'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            {
              name: 'Mi biblioteca',
              short_name: 'Biblioteca',
              url: `${base}biblioteca`,
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Buscar libros',
              short_name: 'Buscar',
              url: `${base}buscar`,
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          importScripts: ['push-sw.js'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'book-images-v1',
                expiration: { maxEntries: 30, maxAgeSeconds: 2_592_000 },
              },
            },
          ],
        },
        devOptions: { enabled: true, navigateFallbackAllowlist: [/^\//] },
      }),
    ],
    build: {
      sourcemap: false,
      target: 'es2022',
      rolldownOptions: {
        output: {
          codeSplitting: { groups: [{ name: 'supabase-client', test: /node_modules[\\/]@supabase[\\/]/ }] },
        },
      },
    },
  }
})
