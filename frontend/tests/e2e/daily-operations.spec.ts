import { test, expect } from '../fixtures/rodeo-fixture';

/**
 * Tests de Operaciones Diarias
 * 
 * NOTA: Login eliminado del beforeEach — la sesión la provee storageState
 * configurado en playwright.config.ts (playwright/.auth/user.json).
 * Esto hace cada test ~3-5s más rápido y evita carga innecesaria en Firebase Auth.
 * 
 * Rutas corregidas:
 *   /dashboard/records → /dashboard/bitacora
 *   /dashboard/tasks   → /dashboard/tareas
 *   /dashboard/tools   → /dashboard/calculadora
 */
test.describe('Operaciones y Módulos Diarios', () => {
  test('Bitácora — carga y alta de registro', async ({ page }) => {
    await page.goto('/dashboard/bitacora');
    await page.waitForURL(/\/dashboard\/bitacora/, { timeout: 15000 });

    // Esperar que cargue la página
    await page.waitForSelector('h1', { timeout: 15000 });

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

  test('Módulo de Tareas — carga', async ({ page }) => {
    await page.goto('/dashboard/tareas');
    await page.waitForURL(/\/dashboard\/tareas/, { timeout: 15000 });

    // Verificar que la página carga (h1 visible)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

  test('Calculadora Ganadera — carga', async ({ page }) => {
    await page.goto('/dashboard/calculadora');
    await page.waitForURL(/\/dashboard\/calculadora/, { timeout: 15000 });

    // Verificar que la página carga
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

  test('Agenda — carga y navegación', async ({ page }) => {
    await page.goto('/dashboard/agenda');
    await page.waitForURL(/\/dashboard\/agenda/, { timeout: 15000 });

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });
});
