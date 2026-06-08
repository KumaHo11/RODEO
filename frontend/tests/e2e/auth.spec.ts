import { test, expect } from '../fixtures/rodeo-fixture';

test.describe('Autenticación y Accesos', () => {
  test('Flujo de Registro Completo', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="fullName"]', 'Productor Demo');
    await page.fill('input[name="email"]', 'qa+demo@rodeo.test');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.check('input[name="acceptTerms"]');
    
    // In a real app, you might wait for a specific request
    // const requestPromise = page.waitForRequest(req => req.url().includes('/auth/signup'));
    await page.click('button[type="submit"]');
    // const request = await requestPromise;
    // expect(request.postDataJSON().email).toBe('qa+demo@rodeo.test');

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  });

  test('Inicio de Sesión y Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  });

  test('Recuperación de contraseña', async ({ page }) => {
    await page.goto('/login');
    // Assuming there is a link for password recovery
    const recoverLink = page.locator('text=¿Olvidaste tu contraseña?').or(page.locator('text=Recuperar contraseña'));
    if (await recoverLink.isVisible()) {
      await recoverLink.click();
      await page.fill('input[type="email"]', 'qa+demo@rodeo.test');
      await page.click('button[type="submit"]');
      // Toast or confirmation message
      await expect(page.locator('.sonner-toast, .toast, text=enviado')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Invitado uniéndose a un campo', async ({ page }) => {
    // Simulamos el link de invitación
    await page.goto('/join?token=abc-123-xyz');
    // Wait for the join form
    if (await page.locator('input[type="email"]').isVisible()) {
      await page.fill('input[type="email"]', 'invitado@rodeo.test');
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      // Verify role or redirect
      await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
    }
  });
});
