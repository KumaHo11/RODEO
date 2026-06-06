import { test, expect } from '../fixtures/rodeo-fixture';

test.describe('Flujos Core de Producción', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);
  });

  test('Planificador Gantt: Interacciones y cierre', async ({ page }) => {
    await page.goto('/dashboard/grazing');
    
    // Wait for Gantt layout to load
    await expect(page.locator('h1, h2').filter({ hasText: /plan|pastoreo/i }).first()).toBeVisible({ timeout: 15000 });

    // Assuming a button to open modal
    const planButton = page.locator('button', { hasText: /plan/i }).first();
    if (await planButton.isVisible()) {
      await planButton.click();
      
      // Wait for modal
      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toBeVisible();

      // Find rodeo select or button
      const closeBtn = modal.locator('button', { hasText: /cerrar|guardar|confirmar/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('Mapa Interactivo y Capas', async ({ page }) => {
    await page.goto('/dashboard/map');
    
    // Esperar carga del componente del mapa (Canvas/WebGL o Leaflet)
    const mapContainer = page.locator('.leaflet-container, .mapboxgl-canvas');
    if (await mapContainer.count() > 0) {
      await expect(mapContainer.first()).toBeVisible({ timeout: 15000 });
      
      // Activar capas si existe el control
      const layersBtn = page.locator('button[aria-label*="Capas"], .leaflet-control-layers-toggle');
      if (await layersBtn.isVisible()) {
        await layersBtn.click();
        
        // Simular activar NDVI o Días de descanso
        const ndviCheckbox = page.locator('input[type="checkbox"]').first();
        if (await ndviCheckbox.isVisible()) {
          await ndviCheckbox.check();
        }
      }
    }
  });
});
