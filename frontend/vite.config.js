import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api/pdf': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pdf/, '')
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      }
    }
  },
});
