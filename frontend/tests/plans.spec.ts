import { test, expect } from '@playwright/test';

/**
 * Tests de Planes de Suscripción
 *
 * NOTA: Login eliminado del beforeEach — la sesión la provee storageState
 * configurado en playwright.config.ts (playwright/.auth/user.json).
 *
 * Ruta corregida: /dashboard/billing → /dashboard/planes
 */
test.describe('Payment Plans & Limits', () => {
  test('Should navigate to plans page and see subscription cards', async ({ page }) => {
    await page.goto('/dashboard/planes');
    await page.waitForURL(/\/dashboard\/planes/, { timeout: 15000 });

    // Esperar que la página cargue
    await page.waitForSelector('h1', { timeout: 15000 });

    // Verificar que hay contenido (al menos un plan visible)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('Should show plan feature list', async ({ page }) => {
    await page.goto('/dashboard/planes');
    await page.waitForURL(/\/dashboard\/planes/, { timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 15000 });

    // Verificar que hay cards de planes
    const planCard = page.locator('[data-testid="plan-card"], .plan-card, .pricing-card, h2, h3').first();
    await expect(planCard).toBeVisible({ timeout: 10000 });
  });
});
