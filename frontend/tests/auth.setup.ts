import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');
  
  // Wait for the form
  await page.waitForSelector('form');

  // Fill in credentials
  await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  await page.fill('input[type="password"]', '1q2w3e4r');
  
  // Submit the form
  await page.click('button[type="submit"]');

  // Wait until the dashboard or onboarding loads
  await page.waitForURL(/.*(dashboard|onboarding).*/);

  // Save the authentication state
  await page.context().storageState({ path: authFile });
});
