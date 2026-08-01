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
    testTimeout: 30000,
    include: [
      'src/resources/simulations/__tests__/**/*.test.ts',
      'src/lib/__tests__/**/*.test.ts',
      'src/lib/__tests__/**/*.test.tsx',
      'src/lib/data-governance/__tests__/**/*.test.ts',
      'src/lib/course-basis/__tests__/**/*.test.ts',
      'src/app/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.ts',
      'src/features/admin/__tests__/**/*.test.tsx',
      'src/features/ai/__tests__/**/*.test.ts',
      'src/features/ai/__tests__/**/*.test.tsx',
      'src/features/adaptive-assessment/__tests__/**/*.test.ts',
      'src/features/adaptive-learning/__tests__/**/*.test.ts',
      'src/features/assessment/__tests__/**/*.test.ts',
      'src/features/knowledge/__tests__/**/*.test.ts',
      'src/features/arena/__tests__/**/*.test.ts',
      'src/features/arena/__tests__/**/*.test.tsx',
      'src/features/classroom/__tests__/**/*.test.ts',
      'src/features/control-workbench/__tests__/**/*.test.ts',
      'src/features/data-center/__tests__/**/*.test.ts',
      'src/app/api/classes/**/__tests__/**/*.test.ts',
      'src/app/api/session/**/__tests__/**/*.test.ts',
      'src/app/api/arena/**/__tests__/**/*.test.ts',
      'src/app/api/admin/**/__tests__/**/*.test.ts',
      'src/app/api/interactive/**/__tests__/**/*.test.ts',
      'src/app/api/learning-paths/**/__tests__/**/*.test.ts',
      'src/app/api/teacher/**/__tests__/**/*.test.ts',
      'src/app/api/teacher/arena/**/__tests__/**/*.test.ts',
      'src/app/classroom/**/__tests__/**/*.test.tsx',
      'src/features/interactive/__tests__/**/*.test.ts',
      'src/features/interactive/__tests__/**/*.test.tsx',
      'src/features/teacher/__tests__/**/*.test.ts',
      'src/features/teacher/__tests__/**/*.test.tsx',
      'src/features/assignment-authoring/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
