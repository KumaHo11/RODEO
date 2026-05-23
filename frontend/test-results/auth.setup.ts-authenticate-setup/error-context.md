# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate
- Location: tests/auth.setup.ts:6:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('form') to be visible

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
  1  | import { test as setup, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | const authFile = path.join(__dirname, '../playwright/.auth/user.json');
  5  | 
  6  | setup('authenticate', async ({ page }) => {
  7  |   // Go to login page
  8  |   await page.goto('/login');
  9  |   
  10 |   // Wait for the form
> 11 |   await page.waitForSelector('form');
     |              ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  12 | 
  13 |   // Fill in credentials
  14 |   await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  15 |   await page.fill('input[type="password"]', '1q2w3e4r');
  16 |   
  17 |   // Submit the form
  18 |   await page.click('button[type="submit"]');
  19 | 
  20 |   // Wait until the dashboard or onboarding loads
  21 |   await page.waitForURL(/.*(dashboard|onboarding).*/);
  22 | 
  23 |   // Save the authentication state
  24 |   await page.context().storageState({ path: authFile });
  25 | });
  26 | 
```