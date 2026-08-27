import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: [
      'src/**/__tests__/**/*.integration.test.{ts,tsx}',
      'src/**/__tests__/**/*.real-db*.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
