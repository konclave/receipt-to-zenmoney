// vite.config.ts
import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Receipt to ZenMoney',
        short_name: 'ReceiptZM',
        description: 'Photograph receipts and import transactions into ZenMoney',
        theme_color: '#6c63ff',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html'
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true
  }
})
