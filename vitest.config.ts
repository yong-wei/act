import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/lib/data-governance/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
