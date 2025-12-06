import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: false, // SSE doesn't use WebSocket
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            // Ignore connection errors - server might not be ready yet
            if (res && !res.headersSent) {
              console.log('[Vite] Proxy error (server may not be ready):', err.message);
            }
          });
        },
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
