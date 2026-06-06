# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/core-production.spec.ts >> Flujos Core de Producción >> Mapa Interactivo y Capas
- Location: tests/e2e/core-production.spec.ts:35:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: Errores en consola de navegador detectados: [{"type":"error","text":"Can't perform a React state update on a component that hasn't mounted yet. This indicates that you have a side-effect in your render function that asynchronously tries to update the component. Move this work to useEffect instead."},{"type":"error","text":"A bad HTTP response code (404) was received when fetching the script."}]

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active]:
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e6] [cursor=pointer]:
    - img [ref=e7]
  - alert [ref=e10]
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/rodeo-fixture';
  2  | 
  3  | test.describe('Flujos Core de Producción', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/login');
> 6  |     await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  7  |     await page.fill('input[type="password"]', '1q2w3e4r');
  8  |     await page.click('button[type="submit"]');
  9  |     await page.waitForURL(/\/dashboard|\/onboarding/);
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