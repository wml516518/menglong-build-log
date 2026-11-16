import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/apps/history-galaxy/',
  build: {
    outDir: 'dist-history',
    chunkSizeWarningLimit: 1100,
    rollupOptions: { input: 'history.html' }
  }
});
