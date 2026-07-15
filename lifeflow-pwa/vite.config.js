import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LifeFlow - AI 生活 SOP 编排器',
        short_name: 'LifeFlow',
        description: '把复杂生活任务变成可执行流程',
        theme_color: '#f0efec',
        background_color: '#f0efec',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
