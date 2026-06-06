# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> Accessibility and UI tests >> Login form should pass accessibility (requires logging out first)
- Location: tests/a11y.spec.ts:17:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('h1:has-text("Rodeos")') to be visible
    - waiting for" http://localhost:3000/login?next=%2Fdashboard%2Fherds" navigation to finish...
    - navigated to "http://localhost:3000/login?next=%2Fdashboard%2Fherds"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "Inicia sesión" [level=1] [ref=e6]
        - paragraph [ref=e7]: Ingresa a tu cuenta para gestionar tu campo.
      - generic [ref=e8]:
        - generic [ref=e9]:
          - text: Correo electrónico
          - textbox "tu@email.com" [ref=e10]
        - generic [ref=e11]:
          - generic [ref=e12]:
            - generic [ref=e13]: Contraseña
            - link "¿Olvidaste tu contraseña?" [ref=e14] [cursor=pointer]:
              - /url: /forgot-password
          - generic [ref=e15]:
            - textbox "••••••••" [ref=e16]
            - button [ref=e17] [cursor=pointer]:
              - img [ref=e18]
        - button "Ingresar" [ref=e21] [cursor=pointer]:
          - text: Ingresar
          - img [ref=e22]
      - paragraph [ref=e24]:
        - text: ¿No tienes una cuenta?
        - link "Regístrate" [ref=e25] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32]
  - alert [ref=e35]
  - iframe [ref=e36]:
    
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | test.describe('Accessibility and UI tests', () => {
  5  | 
  6  |   test.beforeEach(async ({ page }) => {
  7  |     // Log in before each test to ensure IndexedDB session is active
  8  |     await page.goto('/login');
  9  |     await page.waitForSelector('form');
  10 |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  11 |     await page.fill('input[type="password"]', '1q2w3e4r');
  12 |     await page.click('button[type="submit"]');
  13 |     // Wait until the dashboard or onboarding loads
  14 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  15 |   });
  16 | 
  17 |   test('Login form should pass accessibility (requires logging out first)', async ({ page }) => {
  18 |     // We need to go back to login to test its accessibility
  19 |     // The easiest way is to use a new clean context, but we are inside beforeEach.
  20 |     // We will just evaluate a sign out if possible, or just test a11y on the current page (dashboard).
  21 |     // Actually, let's test Rodeos accessibility here.
  22 |     
  23 |     await page.goto('/dashboard/herds');
> 24 |     await page.waitForSelector('h1:has-text("Rodeos")', { timeout: 15000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  25 | 
  26 |     const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  27 |     
  28 |     // Output violations if any for debugging
  29 |     if (accessibilityScanResults.violations.length > 0) {
  30 |       console.log('Axe violations found in Rodeos:', JSON.stringify(accessibilityScanResults.violations, null, 2));
  31 |     }
  32 | 
  33 |     expect(accessibilityScanResults.violations).toEqual([]);
  34 |   });
  35 | });
  36 | 
  37 | test.describe('Login Accessibility', () => {
  38 |   // Separate describe block without the login beforeEach
  39 |   test('Login form should be keyboard navigable and pass accessibility', async ({ page }) => {
  40 |     await page.goto('/login');
  41 | 
  42 |     const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  43 |     
  44 |     if (accessibilityScanResults.violations.length > 0) {
  45 |       console.log('Axe violations found in Login:', JSON.stringify(accessibilityScanResults.violations, null, 2));
  46 |     }
  47 | 
  48 |     expect(accessibilityScanResults.violations).toEqual([]);
  49 | 
  50 |     await page.focus('body');
  51 |     await page.keyboard.press('Tab');
  52 |     const emailInput = page.locator('input[type="email"]');
  53 |     await expect(emailInput).toBeVisible();
  54 |   });
  55 | });
  56 | 
```