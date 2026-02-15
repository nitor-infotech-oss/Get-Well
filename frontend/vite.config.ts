import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Polyfill Node.js globals for amazon-chime-sdk-js
    global: 'globalThis',
  },
  optimizeDeps: {
    // Ensure Vite pre-bundles the buffer polyfill for the Chime SDK
    include: ['buffer', 'amazon-chime-sdk-js'],
  },
})
