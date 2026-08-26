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
      'src/app/api/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'scripts/knowledge-governance/input-inventory/__tests__/**/*.test.ts',
    ],
    exclude: [
      '**/*.integration.test.*',
      '**/*.real-db.*',
      '**/*.real-smoke.test.*',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
