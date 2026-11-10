import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1100
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    ...(process.env.CI ? { maxWorkers: 2, minWorkers: 1 } : {})
  }
});
