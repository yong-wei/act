import { defineConfig } from '@playwright/test';

const REAL_PROVIDER_ACCEPTANCE_TIMEOUT_MS = 120 * 60_000;

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.SMART_LESSON_E2E_SPEC ?? 'smart-lesson-plan-real-e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED === '1'
    ? REAL_PROVIDER_ACCEPTANCE_TIMEOUT_MS
    : 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.SMART_LESSON_E2E_BASE_URL,
    trace: 'retain-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
});
