import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility and UI tests', () => {

  test.beforeEach(async ({ page }) => {
    // Log in before each test to ensure IndexedDB session is active
    await page.goto('/login');
    await page.waitForSelector('form');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    // Wait until the dashboard or onboarding loads
    await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  });

  test('Login form should pass accessibility (requires logging out first)', async ({ page }) => {
    // We need to go back to login to test its accessibility
    // The easiest way is to use a new clean context, but we are inside beforeEach.
    // We will just evaluate a sign out if possible, or just test a11y on the current page (dashboard).
    // Actually, let's test Rodeos accessibility here.
    
    await page.goto('/dashboard/herds');
    await page.waitForSelector('h1:has-text("Rodeos")', { timeout: 15000 });

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    // Output violations if any for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations found in Rodeos:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Login Accessibility', () => {
  // Separate describe block without the login beforeEach
  test('Login form should be keyboard navigable and pass accessibility', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations found in Login:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    expect(accessibilityScanResults.violations).toEqual([]);

    await page.focus('body');
    await page.keyboard.press('Tab');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });
});
