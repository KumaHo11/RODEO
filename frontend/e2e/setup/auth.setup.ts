import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Ensure the auth directory exists
  const authDir = path.dirname(STORAGE_STATE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Navigate to login
  await page.goto('/login');

  // Wait for the login form to be ready
  await page.waitForSelector('form');

  // Fill credentials (validated against staging Firebase Auth)
  await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  await page.fill('input[type="password"]', '1q2w3e4r');

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or onboarding (staging can be slow)
  await page.waitForURL(/.*(dashboard|onboarding|terms-accept).*/, {
    timeout: 45_000,
  });

  // If redirected to terms-accept, handle it
  if (page.url().includes('terms-accept')) {
    const acceptBtn = page.locator('button:has-text("Acepto"), button:has-text("Aceptar")');
    if (await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 30_000 });
    }
  }

  // Verify we have the __session cookie (critical for offline persistence)
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === '__session');
  expect(sessionCookie, 'Expected __session cookie to be set after login').toBeTruthy();

  // Wait a moment for IndexedDB to initialize
  await page.waitForTimeout(3_000);

  // Persist the authenticated state
  await page.context().storageState({ path: STORAGE_STATE });
});
