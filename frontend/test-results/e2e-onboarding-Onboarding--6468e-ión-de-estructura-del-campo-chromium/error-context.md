# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/onboarding.spec.ts >> Onboarding y Configuración Inicial >> Creación de estructura del campo
- Location: tests/e2e/onboarding.spec.ts:13:7

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
  3  | test.describe('Onboarding y Configuración Inicial', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Basic login before onboarding
  6  |     await page.goto('/login');
  7  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  8  |     await page.fill('input[type="password"]', '1q2w3e4r');
  9  |     await page.click('button[type="submit"]');
> 10 |     await page.waitForURL(/\/dashboard|\/onboarding/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  11 |   });
  12 | 
  13 |   test('Creación de estructura del campo', async ({ page }) => {
  14 |     await page.goto('/onboarding');
  15 |     
  16 |     // This is a figurative test case, ensuring that inputs and buttons
  17 |     // commonly found in the onboarding wizard can be interacted with.
  18 |     
  19 |     // Wait for onboarding to load
  20 |     await page.waitForLoadState('networkidle');
  21 | 
  22 |     // Just verifying the page title or a known element exists
  23 |     // The exact selectors will be adjusted once the UI is finalized
  24 |     const continueBtn = page.locator('button:has-text("Continuar"), button:has-text("Siguiente")').first();
  25 |     
  26 |     if (await continueBtn.isVisible()) {
  27 |       // Step 1: Ubicación
  28 |       const locationInput = page.locator('input[name="location"], input[placeholder*="Ubicación"]');
  29 |       if (await locationInput.isVisible()) await locationInput.fill('Ruta Prov 4');
  30 |       await continueBtn.click();
  31 |       
  32 |       // Step 2: Potreros
  33 |       const addPaddockBtn = page.locator('button:has-text("Agregar Potrero"), button:has-text("Nuevo Potrero")');
  34 |       if (await addPaddockBtn.isVisible()) {
  35 |         await addPaddockBtn.click();
  36 |         const paddockName = page.locator('input[name="name"], input[name="paddockName"]');
  37 |         if (await paddockName.isVisible()) await paddockName.fill('Lote Frontal');
  38 |         const savePaddockBtn = page.locator('button:has-text("Guardar")');
  39 |         if (await savePaddockBtn.isVisible()) await savePaddockBtn.click();
  40 |       }
  41 |       await continueBtn.click();
  42 |     }
  43 |   });
  44 | });
  45 | 
```