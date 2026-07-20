import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/knowledge-governance/identity-candidate-manifest/__tests__/**/*.test.ts'],
  },
});
