import { test, expect } from '../fixtures/rodeo-fixture';

test.describe('Administración, Perfil y Equipo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/onboarding/);
  });

  test('Gestión de Perfil', async ({ page }) => {
    await page.goto('/dashboard/settings');
    
    const profileSection = page.locator('text=Perfil').first();
    if (await profileSection.isVisible()) {
      await profileSection.click();
      
      const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('+549112345678');
        const updateBtn = page.locator('button:has-text("Guardar"), button:has-text("Actualizar")').first();
        if (await updateBtn.isVisible()) await updateBtn.click();
        
        await expect(page.locator('.toast, .sonner-toast')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Gestión de Equipo e Invitaciones', async ({ page }) => {
    await page.goto('/dashboard/team');
    
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
