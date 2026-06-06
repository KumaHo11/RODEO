# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/daily-operations.spec.ts >> Operaciones y Módulos Diarios >> Módulo de Tareas
- Location: tests/e2e/daily-operations.spec.ts:31:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
  navigated to "http://localhost:3000/login?next=%2Fdashboard"
============================================================
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
    - img [ref=e36]
  - alert [ref=e39]
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Operaciones y Módulos Diarios', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  7  |     await page.fill('input[type="password"]', '1q2w3e4r');
  8  |     await page.click('button[type="submit"]');
> 9  |     await page.waitForURL(/\/dashboard|\/onboarding/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  10 |   });
  11 | 
  12 |   test('Bitácora y Transcripción (Simulación)', async ({ page }) => {
  13 |     // Si la bitácora es /dashboard/records
  14 |     await page.goto('/dashboard/records');
  15 |     
  16 |     // Esperar que cargue
  17 |     const newRecordBtn = page.locator('button:has-text("Nuevo"), button:has-text("Agregar")').first();
  18 |     if (await newRecordBtn.isVisible()) {
  19 |       await newRecordBtn.click();
  20 |       
  21 |       // Llenar datos de lluvia/evento
  22 |       const inputForm = page.locator('input[type="number"], textarea').first();
  23 |       if (await inputForm.isVisible()) {
  24 |         await inputForm.fill('25');
  25 |         const saveBtn = page.locator('button:has-text("Guardar")').first();
  26 |         if (await saveBtn.isVisible()) await saveBtn.click();
  27 |       }
  28 |     }
  29 |   });
  30 | 
  31 |   test('Módulo de Tareas', async ({ page }) => {
  32 |     await page.goto('/dashboard/tasks');
  33 |     
  34 |     const title = page.locator('h1, h2').filter({ hasText: /tarea/i }).first();
  35 |     if (await title.isVisible()) {
  36 |       await expect(title).toBeVisible();
  37 |     }
  38 |   });
  39 | 
  40 |   test('Calculadora Ganadera', async ({ page }) => {
  41 |     await page.goto('/dashboard/tools');
  42 |     
  43 |     // Comprobar que la herramienta cargue
  44 |     const toolTitle = page.locator('text=Calculadora').first();
  45 |     if (await toolTitle.isVisible()) {
  46 |       await expect(toolTitle).toBeVisible();
  47 |     }
  48 |   });
  49 | });
  50 | 
```