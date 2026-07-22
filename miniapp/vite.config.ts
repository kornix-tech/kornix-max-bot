import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/miniapp/',
  plugins: [react()],
  build: {
    outDir: '../dist-miniapp',
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 5173,
    proxy: {
      '/miniapp/api': 'http://127.0.0.1:3000'
    }
  },
  test: {
    environment: 'jsdom'
  }
});
