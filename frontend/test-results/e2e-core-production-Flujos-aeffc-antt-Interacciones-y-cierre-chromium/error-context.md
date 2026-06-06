# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/core-production.spec.ts >> Flujos Core de Producción >> Planificador Gantt: Interacciones y cierre
- Location: tests/e2e/core-production.spec.ts:12:7

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
  - alert [ref=e39]: Inicia sesión
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Flujos Core de Producción', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
  7  |     await page.fill('input[type="password"]', '1q2w3e4r');
  8  |     await page.click('button[type="submit"]');
> 9  |     await page.waitForURL(/\/dashboard|\/onboarding/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  10 |   });
  11 | 
  12 |   test('Planificador Gantt: Interacciones y cierre', async ({ page }) => {
  13 |     await page.goto('/dashboard/grazing');
  14 |     
  15 |     // Wait for Gantt layout to load
  16 |     await expect(page.locator('h1, h2').filter({ hasText: /plan|pastoreo/i }).first()).toBeVisible({ timeout: 15000 });
  17 | 
  18 |     // Assuming a button to open modal
  19 |     const planButton = page.locator('button', { hasText: /plan/i }).first();
  20 |     if (await planButton.isVisible()) {
  21 |       await planButton.click();
  22 |       
  23 |       // Wait for modal
  24 |       const modal = page.locator('.modal, [role="dialog"]');
  25 |       await expect(modal).toBeVisible();
  26 | 
  27 |       // Find rodeo select or button
  28 |       const closeBtn = modal.locator('button', { hasText: /cerrar|guardar|confirmar/i }).first();
  29 |       if (await closeBtn.isVisible()) {
  30 |         await closeBtn.click();
  31 |       }
  32 |     }
  33 |   });
  34 | 
  35 |   test('Mapa Interactivo y Capas', async ({ page }) => {
  36 |     await page.goto('/dashboard/map');
  37 |     
  38 |     // Esperar carga del componente del mapa (Canvas/WebGL o Leaflet)
  39 |     const mapContainer = page.locator('.leaflet-container, .mapboxgl-canvas');
  40 |     if (await mapContainer.count() > 0) {
  41 |       await expect(mapContainer.first()).toBeVisible({ timeout: 15000 });
  42 |       
  43 |       // Activar capas si existe el control
  44 |       const layersBtn = page.locator('button[aria-label*="Capas"], .leaflet-control-layers-toggle');
  45 |       if (await layersBtn.isVisible()) {
  46 |         await layersBtn.click();
  47 |         
  48 |         // Simular activar NDVI o Días de descanso
  49 |         const ndviCheckbox = page.locator('input[type="checkbox"]').first();
  50 |         if (await ndviCheckbox.isVisible()) {
  51 |           await ndviCheckbox.check();
  52 |         }
  53 |       }
  54 |     }
  55 |   });
  56 | });
  57 | 
```