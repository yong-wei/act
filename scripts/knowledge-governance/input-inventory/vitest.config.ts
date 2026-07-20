import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/knowledge-governance/input-inventory/__tests__/**/*.test.ts'],
    testTimeout: 120_000,
    pool: 'threads',
    maxWorkers: 1,
  },
});
