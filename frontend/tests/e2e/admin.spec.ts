import { test, expect } from '../fixtures/rodeo-fixture';

/**
 * Tests de Administración, Perfil y Equipo
 *
 * NOTA: Login eliminado del beforeEach — la sesión la provee storageState.
 *
 * Rutas corregidas:
 *   /dashboard/settings → /dashboard/profile
 *   /dashboard/team     → /dashboard/equipo
 */
test.describe('Administración, Perfil y Equipo', () => {
  test('Gestión de Perfil — carga y edición', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForURL(/\/dashboard\/profile/, { timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 15000 });

    const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+549112345678');
      const updateBtn = page.locator('button:has-text("Guardar"), button:has-text("Actualizar")').first();
      if (await updateBtn.isVisible()) await updateBtn.click();

      await expect(page.locator('.toast, .sonner-toast')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Gestión de Equipo — carga e invitaciones', async ({ page }) => {
    await page.goto('/dashboard/equipo');
    await page.waitForURL(/\/dashboard\/equipo/, { timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 15000 });

    const inviteBtn = page.locator('button', { hasText: /invitar|nuevo miembro/i }).first();
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();

      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('nuevo@rodeo.test');
        const sendBtn = page.locator('button:has-text("Enviar")').first();
        if (await sendBtn.isVisible()) await sendBtn.click();
      }
    }
  });
});
