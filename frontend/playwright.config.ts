import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const isProduction = baseURL.includes('rodeoagtech.com') || baseURL.includes('rodeo.app');

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporters: HTML para desarrollo, JUnit para CI */
  reporter: process.env.CI
    ? [['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never' }]]
    : 'html',
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Timeouts más generosos en producción (latencia real de red) */
    navigationTimeout: isProduction ? 30_000 : 15_000,
    actionTimeout: isProduction ? 15_000 : 10_000,

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure para debugging */
    screenshot: 'only-on-failure',

    /* Video en retries para debugging de flakiness */
    video: 'retain-on-failure',

    // Configs for the offline testing explicitly available
    offline: false,
  },

  /* Configure projects for major browsers */
  projects: [
    // ── Setup — genera storageState (login) ────────────────────────────────
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // ── Proyecto sin auth — para tests de seguridad / rutas no autenticadas ─
    {
      name: 'security',
      testMatch: /tests\/security\/.*/,
      use: {
        ...devices['Desktop Chrome'],
        // Sin storageState = sin cookie = simula usuario no autenticado
      },
    },

    // ── Chrome Desktop ────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Mobile Chrome ────────────────────────────────────────────────────
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
