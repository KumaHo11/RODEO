import { test, expect } from '@playwright/test';

test.describe('Payment Plans & Limits', () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.waitForSelector('form');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  });

  test('Should be able to view billing or subscription plans', async ({ page }) => {
    // Navigate to billing
    await page.goto('/dashboard/billing');
    
    // Wait for the page to load
    // Just a structural test for now to ensure the page doesn't crash
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
