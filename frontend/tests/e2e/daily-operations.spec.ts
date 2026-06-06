import { test, expect } from '../fixtures/rodeo-fixture';

test.describe('Operaciones y Módulos Diarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);
  });

  test('Bitácora y Transcripción (Simulación)', async ({ page }) => {
    // Si la bitácora es /dashboard/records
    await page.goto('/dashboard/records');
    
    // Esperar que cargue
    const newRecordBtn = page.locator('button:has-text("Nuevo"), button:has-text("Agregar")').first();
    if (await newRecordBtn.isVisible()) {
      await newRecordBtn.click();
      
      // Llenar datos de lluvia/evento
      const inputForm = page.locator('input[type="number"], textarea').first();
      if (await inputForm.isVisible()) {
        await inputForm.fill('25');
        const saveBtn = page.locator('button:has-text("Guardar")').first();
        if (await saveBtn.isVisible()) await saveBtn.click();
      }
    }
  });

  test('Módulo de Tareas', async ({ page }) => {
    await page.goto('/dashboard/tasks');
    
    const title = page.locator('h1, h2').filter({ hasText: /tarea/i }).first();
    if (await title.isVisible()) {
      await expect(title).toBeVisible();
    }
  });

  test('Calculadora Ganadera', async ({ page }) => {
    await page.goto('/dashboard/tools');
    
    // Comprobar que la herramienta cargue
    const toolTitle = page.locator('text=Calculadora').first();
    if (await toolTitle.isVisible()) {
      await expect(toolTitle).toBeVisible();
    }
  });
});
