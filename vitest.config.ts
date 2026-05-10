import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/lib/data-governance/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.tsx',
      'src/features/arena/__tests__/**/*.test.ts',
      'src/features/arena/__tests__/**/*.test.tsx',
      'src/app/api/arena/**/__tests__/**/*.test.ts',
      'src/app/api/teacher/arena/**/__tests__/**/*.test.ts',
      'src/features/interactive/__tests__/**/*.test.ts',
      'src/features/interactive/__tests__/**/*.test.tsx',
      'src/features/teacher/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
