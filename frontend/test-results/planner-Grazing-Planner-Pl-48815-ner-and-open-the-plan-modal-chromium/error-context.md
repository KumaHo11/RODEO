# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planner.spec.ts >> Grazing Planner (Planificador) >> Should be able to navigate to the grazing planner and open the plan modal
- Location: tests/planner.spec.ts:14:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('form') to be visible

```

# Page snapshot

```yaml
- generic [active]:
  - region "Notifications alt+T"
  - alert [ref=e1]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Grazing Planner (Planificador)', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Log in
  6  |     await page.goto('/login');
> 7  |     await page.waitForSelector('form');
     |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  8  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  9  |     await page.fill('input[type="password"]', '1q2w3e4r');
  10 |     await page.click('button[type="submit"]');
  11 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  12 |   });
  13 | 
  14 |   test('Should be able to navigate to the grazing planner and open the plan modal', async ({ page }) => {
  15 |     // Go to grazing
  16 |     await page.goto('/dashboard/grazing');
  17 |     
  18 |     // Wait for the page to load, there should be some heading like "Planificador" or "Pastoreo"
  19 |     // Since page.tsx is huge, we just wait for a visible element that indicates it's the planner
  20 |     await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  21 | 
  22 |     // The user mentioned "manual y sugerido". There must be a button to open the planner modal.
  23 |     // Let's just check the page renders successfully first.
  24 |     // We can expand this test once we know the specific selectors.
  25 |     
  26 |     // Look for a button containing "plan" or "Plan"
  27 |     const planButton = page.locator('button', { hasText: /plan/i }).first();
  28 |     if (await planButton.isVisible()) {
  29 |       await planButton.click();
  30 |       
  31 |       // Wait for the modal (SeasonPlanModal)
  32 |       await expect(page.locator('text=Planificador')).toBeVisible({ timeout: 5000 });
  33 |     }
  34 |   });
  35 | });
  36 | 
```