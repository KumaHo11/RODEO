import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://staging.rodeoagtech.com';
const isStaging = baseURL.includes('staging') || baseURL.includes('rodeoagtech.com');

export default defineConfig({
  testDir: './e2e/specs',

  /* ── Serialización obligatoria para tests de sync offline ───────────────── */
  fullyParallel: false,
  workers: 1,

  /* ── Timeouts generosos para staging ────────────────────────────────────── */
  timeout: 90_000,
  expect: { timeout: 15_000 },

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,

  reporter: process.env.CI
    ? [['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never' }]]
    : 'html',

  use: {
    baseURL,

    navigationTimeout: isStaging ? 30_000 : 15_000,
    actionTimeout: isStaging ? 15_000 : 10_000,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Browser-level offline is initially disabled */
    offline: false,
  },

  projects: [
    // ── Setup: authenticate and persist storageState ──────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './e2e/setup',
    },

    // ── Chromium Desktop — primary project ────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
        permissions: ['microphone', 'camera'],
      },
      dependencies: ['setup'],
    },

    // ── Mobile Chrome (disabled for initial iteration) ────────────────────
    // {
    //   name: 'mobile-chrome',
    //   use: {
    //     ...devices['Pixel 7'],
    //     storageState: 'e2e/.auth/user.json',
    //     permissions: ['microphone', 'camera'],
    //   },
    //   dependencies: ['setup'],
    // },
  ],
});
