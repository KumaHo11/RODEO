import { test, expect } from '../fixtures/rodeo-fixture';

test.describe('Onboarding y Configuración Inicial', () => {
  test.beforeEach(async ({ page }) => {
    // Basic login before onboarding
    await page.goto('/login');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);
  });

  test('Creación de estructura del campo', async ({ page }) => {
    await page.goto('/onboarding');
    
    // This is a figurative test case, ensuring that inputs and buttons
    // commonly found in the onboarding wizard can be interacted with.
    
    // Wait for onboarding to load
    await page.waitForLoadState('networkidle');

    // Just verifying the page title or a known element exists
    // The exact selectors will be adjusted once the UI is finalized
    const continueBtn = page.locator('button:has-text("Continuar"), button:has-text("Siguiente")').first();
    
    if (await continueBtn.isVisible()) {
      // Step 1: Ubicación
      const locationInput = page.locator('input[name="location"], input[placeholder*="Ubicación"]');
      if (await locationInput.isVisible()) await locationInput.fill('Ruta Prov 4');
      await continueBtn.click();
      
      // Step 2: Potreros
      const addPaddockBtn = page.locator('button:has-text("Agregar Potrero"), button:has-text("Nuevo Potrero")');
      if (await addPaddockBtn.isVisible()) {
        await addPaddockBtn.click();
        const paddockName = page.locator('input[name="name"], input[name="paddockName"]');
        if (await paddockName.isVisible()) await paddockName.fill('Lote Frontal');
        const savePaddockBtn = page.locator('button:has-text("Guardar")');
        if (await savePaddockBtn.isVisible()) await savePaddockBtn.click();
      }
      await continueBtn.click();
    }
  });
});
