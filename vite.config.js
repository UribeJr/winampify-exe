import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      '/login': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      },
      '/callback': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      },
      '/refresh_token': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
});

