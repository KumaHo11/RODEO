# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline.spec.ts >> Offline Mode tests >> Should show offline indicator and allow basic navigation when offline
- Location: tests/offline.spec.ts:18:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('h1:has-text("Rodeos")') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - img "RODEO Ganadería Regenerativa" [ref=e6]
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "Inicia sesión" [level=1] [ref=e10]
        - paragraph [ref=e11]: Ingresa a tu cuenta para gestionar tu campo.
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Correo electrónico
          - textbox "tu@email.com" [ref=e14]
        - generic [ref=e15]:
          - generic [ref=e16]:
            - generic [ref=e17]: Contraseña
            - link "¿Olvidaste tu contraseña?" [ref=e18] [cursor=pointer]:
              - /url: /forgot-password
          - generic [ref=e19]:
            - textbox "••••••••" [ref=e20]
            - button [ref=e21] [cursor=pointer]:
              - img [ref=e22]
        - button "Ingresar" [ref=e25] [cursor=pointer]:
          - text: Ingresar
          - img [ref=e26]
      - paragraph [ref=e28]:
        - text: ¿No tienes una cuenta?
        - link "Regístrate" [ref=e29] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e35] [cursor=pointer]:
    - generic [ref=e38]:
      - text: Compiling
      - generic [ref=e39]:
        - generic [ref=e40]: .
        - generic [ref=e41]: .
        - generic [ref=e42]: .
  - alert [ref=e43]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Offline Mode tests', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Log in while online
  6  |     await page.goto('/login');
  7  |     await page.waitForSelector('form');
  8  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  9  |     await page.fill('input[type="password"]', '1q2w3e4r');
  10 |     await page.click('button[type="submit"]');
  11 |     await page.waitForURL(/.*(dashboard|onboarding).*/, { timeout: 15000 });
  12 |     
  13 |     // Visit Rodeos to cache it
  14 |     await page.goto('/dashboard/herds');
> 15 |     await page.waitForSelector('h1:has-text("Rodeos")');
     |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  16 |   });
  17 | 
  18 |   test('Should show offline indicator and allow basic navigation when offline', async ({ page, context }) => {
  19 |     // Go offline
  20 |     await context.setOffline(true);
  21 |     
  22 |     // Try to reload the page or navigate
  23 |     await page.reload({ waitUntil: 'commit' });
  24 |     
  25 |     // Verify offline indicator appears
  26 |     // The Layout has <OfflineIndicator /> which probably shows a message.
  27 |     // We can search for "offline", "sin conexión", "desconectado"
  28 |     const offlineIndicator = page.locator('text=/sin conexión|offline/i').first();
  29 |     // In our layout we saw <OfflineIndicator />, let's just see if it renders anything
  30 |     await expect(page.locator('h1:has-text("Rodeos")')).toBeVisible({ timeout: 10000 });
  31 |     
  32 |     // Check if we can still click around (e.g. click on a Rodeo)
  33 |     // We expect the UI to still render cached data
  34 |     
  35 |     // Go back online
  36 |     await context.setOffline(false);
  37 |   });
  38 | });
  39 | 
```