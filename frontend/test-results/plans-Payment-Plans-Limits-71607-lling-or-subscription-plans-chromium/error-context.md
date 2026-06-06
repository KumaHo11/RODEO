# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: plans.spec.ts >> Payment Plans & Limits >> Should be able to view billing or subscription plans
- Location: tests/plans.spec.ts:14:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/dashboard/billing", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - img [ref=e3]
    - paragraph [ref=e5]: Verificando sesión...
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Payment Plans & Limits', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Log in
  6  |     await page.goto('/login');
  7  |     await page.waitForSelector('form');
  8  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  9  |     await page.fill('input[type="password"]', '1q2w3e4r');
  10 |     await page.click('button[type="submit"]');
  11 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  12 |   });
  13 | 
  14 |   test('Should be able to view billing or subscription plans', async ({ page }) => {
  15 |     // Navigate to billing
> 16 |     await page.goto('/dashboard/billing');
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  17 |     
  18 |     // Wait for the page to load
  19 |     // Just a structural test for now to ensure the page doesn't crash
  20 |     const bodyText = await page.locator('body').innerText();
  21 |     expect(bodyText.length).toBeGreaterThan(0);
  22 |   });
  23 | });
  24 | 
```