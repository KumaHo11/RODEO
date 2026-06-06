# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/admin.spec.ts >> Administración, Perfil y Equipo >> Gestión de Equipo e Invitaciones
- Location: tests/e2e/admin.spec.ts:30:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 5
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
============================================================
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
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Administración, Perfil y Equipo', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  7  |     await page.fill('input[type="password"]', '1q2w3e4r');
  8  |     await page.click('button[type="submit"]');
> 9  |     await page.waitForURL(/\/dashboard|\/onboarding/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  10 |   });
  11 | 
  12 |   test('Gestión de Perfil', async ({ page }) => {
  13 |     await page.goto('/dashboard/settings');
  14 |     
  15 |     const profileSection = page.locator('text=Perfil').first();
  16 |     if (await profileSection.isVisible()) {
  17 |       await profileSection.click();
  18 |       
  19 |       const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
  20 |       if (await phoneInput.isVisible()) {
  21 |         await phoneInput.fill('+549112345678');
  22 |         const updateBtn = page.locator('button:has-text("Guardar"), button:has-text("Actualizar")').first();
  23 |         if (await updateBtn.isVisible()) await updateBtn.click();
  24 |         
  25 |         await expect(page.locator('.toast, .sonner-toast')).toBeVisible({ timeout: 5000 });
  26 |       }
  27 |     }
  28 |   });
  29 | 
  30 |   test('Gestión de Equipo e Invitaciones', async ({ page }) => {
  31 |     await page.goto('/dashboard/team');
  32 |     
  33 |     const inviteBtn = page.locator('button', { hasText: /invitar|nuevo miembro/i }).first();
  34 |     if (await inviteBtn.isVisible()) {
  35 |       await inviteBtn.click();
  36 |       
  37 |       const emailInput = page.locator('input[type="email"]').first();
  38 |       if (await emailInput.isVisible()) {
  39 |         await emailInput.fill('nuevo@rodeo.test');
  40 |         const sendBtn = page.locator('button:has-text("Enviar")').first();
  41 |         if (await sendBtn.isVisible()) await sendBtn.click();
  42 |       }
  43 |     }
  44 |   });
  45 | });
  46 | 
```