# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/auth.spec.ts >> Autenticación y Accesos >> Flujo de Registro Completo
- Location: tests/e2e/auth.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 5
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="fullName"]')

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
  - iframe [ref=e35]:
    
  - alert [ref=e36]
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Autenticación y Accesos', () => {
  4  |   test('Flujo de Registro Completo', async ({ page }) => {
  5  |     await page.goto('/register');
> 6  |     await page.fill('input[name="fullName"]', 'Productor Demo');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  7  |     await page.fill('input[name="email"]', 'qa+demo@rodeo.test');
  8  |     await page.fill('input[name="password"]', 'S3gur1d4d#2024');
  9  |     await page.check('input[name="acceptTerms"]');
  10 |     
  11 |     // In a real app, you might wait for a specific request
  12 |     // const requestPromise = page.waitForRequest(req => req.url().includes('/auth/signup'));
  13 |     await page.click('button[type="submit"]');
  14 |     // const request = await requestPromise;
  15 |     // expect(request.postDataJSON().email).toBe('qa+demo@rodeo.test');
  16 | 
  17 |     await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  18 |   });
  19 | 
  20 |   test('Inicio de Sesión y Dashboard', async ({ page }) => {
  21 |     await page.goto('/login');
  22 |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  23 |     await page.fill('input[type="password"]', '1q2w3e4r');
  24 |     await page.click('button[type="submit"]');
  25 |     
  26 |     await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  27 |   });
  28 | 
  29 |   test('Recuperación de contraseña', async ({ page }) => {
  30 |     await page.goto('/login');
  31 |     // Assuming there is a link for password recovery
  32 |     const recoverLink = page.locator('text=¿Olvidaste tu contraseña?').or(page.locator('text=Recuperar contraseña'));
  33 |     if (await recoverLink.isVisible()) {
  34 |       await recoverLink.click();
  35 |       await page.fill('input[type="email"]', 'qa+demo@rodeo.test');
  36 |       await page.click('button[type="submit"]');
  37 |       // Toast or confirmation message
  38 |       await expect(page.locator('.sonner-toast, .toast, text=enviado')).toBeVisible({ timeout: 5000 });
  39 |     }
  40 |   });
  41 | 
  42 |   test('Invitado uniéndose a un campo', async ({ page }) => {
  43 |     // Simulamos el link de invitación
  44 |     await page.goto('/join?token=abc-123-xyz');
  45 |     // Wait for the join form
  46 |     if (await page.locator('input[type="email"]').isVisible()) {
  47 |       await page.fill('input[type="email"]', 'invitado@rodeo.test');
  48 |       await page.fill('input[type="password"]', 'Pass123!');
  49 |       await page.click('button[type="submit"]');
  50 |       // Verify role or redirect
  51 |       await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  52 |     }
  53 |   });
  54 | });
  55 | 
```