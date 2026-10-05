import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import scopeSkin from './tools/scopeSkin.mjs';

// Express API server; override with API_TARGET when running it on another port
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:3001';
const proxied = ['/login', '/callback', '/refresh_token', '/api'];

export default defineConfig({
  plugins: [react()],
  css: {
    // 98.css and xp.css only apply under their skin (see tools/scopeSkin.mjs)
    postcss: { plugins: [scopeSkin()] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    // Spotify only allows loopback (or https) redirect URIs, so dev stays on 127.0.0.1.
    // Use `npm run client -- --host` to preview the UI on a phone over the LAN.
    host: '127.0.0.1',
    port: 3000,
    proxy: Object.fromEntries(
      proxied.map((route) => [route, { target: API_TARGET, changeOrigin: true }])
    )
  }
});
